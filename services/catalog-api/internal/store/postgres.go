package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"magic-shop/catalog-api/internal/domain"
)

var ErrNotFound = errors.New("item not found")
var ErrConflict = errors.New("item conflict")

const columns = "id,name,description,rarity,image,price_copper,category_id,display_stock,active"

type Store struct{ db *pgxpool.Pool }

func Open(ctx context.Context) (*Store, error) {
	secret, err := os.ReadFile("/db-secret/service-password")
	if err != nil {
		return nil, err
	}
	password := strings.TrimSpace(string(secret))
	if password == "" {
		return nil, errors.New("catalog database password missing")
	}
	uri := &url.URL{Scheme: "postgres", User: url.UserPassword("catalog_app", password), Host: "postgres:5432", Path: "/catalog_db"}
	q := uri.Query()
	q.Set("sslmode", "verify-full")
	q.Set("sslrootcert", "/trust/server-ca.pem")
	q.Set("connect_timeout", "5")
	uri.RawQuery = q.Encode()
	config, err := pgxpool.ParseConfig(uri.String())
	if err != nil {
		return nil, err
	}
	config.MaxConns = 4
	config.MinConns = 0
	config.MaxConnLifetime = 30 * time.Minute
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}
func (s *Store) Close() { s.db.Close() }
func (s *Store) Initialize(ctx context.Context) error {
	sql, err := os.ReadFile("/app/migrations/001_items.sql")
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, string(sql)); err != nil {
		return err
	}
	raw, err := os.ReadFile("/app/seed/catalog-items.json")
	if err != nil {
		return err
	}
	var items []domain.Item
	if err = json.Unmarshal(raw, &items); err != nil {
		return err
	}
	if len(items) != 14 {
		return errors.New("unexpected catalog seed count")
	}
	for _, item := range items {
		if !domain.ValidID(item.ID) {
			return errors.New("invalid seed id")
		}
		if err = domain.ValidateFields(domain.Fields{Name: item.Name, Description: item.Description, Rarity: item.Rarity, Image: item.Image, PriceCopper: item.PriceCopper, CategoryID: item.CategoryID, DisplayStock: item.DisplayStock}); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO items (id,name,description,rarity,image,price_copper,category_id,display_stock,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT (id) DO NOTHING`, item.ID, item.Name, item.Description, item.Rarity, item.Image, item.PriceCopper, item.CategoryID, item.DisplayStock)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func scan(row pgx.Row) (domain.Item, error) {
	var i domain.Item
	err := row.Scan(&i.ID, &i.Name, &i.Description, &i.Rarity, &i.Image, &i.PriceCopper, &i.CategoryID, &i.DisplayStock, &i.Active)
	return i, err
}
func (s *Store) List(ctx context.Context, limit int, cursor, category, search string) ([]domain.Item, bool, error) {
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(search)
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM items WHERE active AND id>$1 AND ($2='' OR category_id=$2) AND ($3='' OR name ILIKE '%'||$3||'%' ESCAPE '\') ORDER BY id LIMIT $4`, cursor, category, escaped, limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	out := make([]domain.Item, 0, limit+1)
	for rows.Next() {
		item, scanErr := scan(rows)
		if scanErr != nil {
			return nil, false, scanErr
		}
		out = append(out, item)
	}
	if err = rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, nil
}
func (s *Store) Get(ctx context.Context, id string) (domain.Item, error) {
	item, err := scan(s.db.QueryRow(ctx, `SELECT `+columns+` FROM items WHERE id=$1 AND active`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Item{}, ErrNotFound
	}
	return item, err
}
func (s *Store) Create(ctx context.Context, item domain.Item) error {
	_, err := s.db.Exec(ctx, `INSERT INTO items (id,name,description,rarity,image,price_copper,category_id,display_stock,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`, item.ID, item.Name, item.Description, item.Rarity, item.Image, item.PriceCopper, item.CategoryID, item.DisplayStock)
	if err != nil && strings.Contains(err.Error(), "duplicate key") {
		return ErrConflict
	}
	return err
}
func (s *Store) Update(ctx context.Context, item domain.Item) error {
	tag, err := s.db.Exec(ctx, `UPDATE items SET name=$2,description=$3,rarity=$4,image=$5,price_copper=$6,category_id=$7,display_stock=$8 WHERE id=$1 AND active`, item.ID, item.Name, item.Description, item.Rarity, item.Image, item.PriceCopper, item.CategoryID, item.DisplayStock)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
func (s *Store) Archive(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `UPDATE items SET active=false WHERE id=$1 AND active`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
func (s *Store) Many(ctx context.Context, ids []string) (map[string]domain.Item, error) {
	if len(ids) > 50 {
		return nil, errors.New("too many item ids")
	}
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM items WHERE id=ANY($1) AND active`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	found := make(map[string]domain.Item, len(ids))
	for rows.Next() {
		item, scanErr := scan(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		found[item.ID] = item
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return found, nil
}
func (s *Store) Ready(ctx context.Context) error {
	if err := s.db.Ping(ctx); err != nil {
		return fmt.Errorf("catalog database unavailable: %w", err)
	}
	return nil
}
