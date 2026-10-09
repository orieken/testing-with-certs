package domain

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

const MaxCopper int64 = 9007199254740991

var idPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)
var imagePattern = regexp.MustCompile(`^/images/[a-z0-9-]+\.png$`)
var rarities = map[string]bool{"Common": true, "Uncommon": true, "Rare": true, "Very Rare": true, "Legendary": true, "Artifact": true}

type Item struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Rarity       string  `json:"rarity"`
	Image        string  `json:"image"`
	PriceCopper  int64   `json:"priceCopper"`
	CategoryID   *string `json:"categoryId,omitempty"`
	DisplayStock *int    `json:"displayStock,omitempty"`
	Active       bool    `json:"active"`
}
type Fields struct {
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Rarity       string  `json:"rarity"`
	Image        string  `json:"image"`
	PriceCopper  int64   `json:"priceCopper"`
	CategoryID   *string `json:"categoryId,omitempty"`
	DisplayStock *int    `json:"displayStock,omitempty"`
}
type QuoteLine struct {
	ItemID   string `json:"itemId"`
	Quantity int    `json:"quantity"`
}
type QuotedLine struct {
	ItemID          string `json:"itemId"`
	Name            string `json:"name"`
	UnitPriceCopper int64  `json:"unitPriceCopper"`
	Quantity        int    `json:"quantity"`
	LineTotalCopper int64  `json:"lineTotalCopper"`
}
type Quote struct {
	Lines       []QuotedLine `json:"lines"`
	TotalCopper int64        `json:"totalCopper"`
}

func ValidID(id string) bool { return idPattern.MatchString(id) }
func ValidateFields(f Fields) error {
	if strings.TrimSpace(f.Name) == "" || utf8.RuneCountInString(f.Name) > 120 || utf8.RuneCountInString(f.Description) > 2000 || !rarities[f.Rarity] || !imagePattern.MatchString(f.Image) || f.PriceCopper < 0 || f.PriceCopper > MaxCopper {
		return errors.New("invalid item fields")
	}
	if f.CategoryID != nil && !ValidID(*f.CategoryID) {
		return errors.New("invalid category")
	}
	if f.DisplayStock != nil && (*f.DisplayStock < 0 || *f.DisplayStock > 1000000) {
		return errors.New("invalid display stock")
	}
	return nil
}
func QuoteItems(lines []QuoteLine, items map[string]Item) (Quote, error) {
	if len(lines) < 1 || len(lines) > 50 {
		return Quote{}, errors.New("invalid quote size")
	}
	result := Quote{Lines: make([]QuotedLine, 0, len(lines))}
	for _, line := range lines {
		if !ValidID(line.ItemID) || line.Quantity < 1 || line.Quantity > 100 {
			return Quote{}, errors.New("invalid quote line")
		}
		item, ok := items[line.ItemID]
		if !ok || !item.Active {
			return Quote{}, errors.New("item unavailable")
		}
		if item.DisplayStock != nil && *item.DisplayStock < line.Quantity {
			return Quote{}, errors.New("display stock insufficient")
		}
		if item.PriceCopper > MaxCopper/int64(line.Quantity) {
			return Quote{}, errors.New("quote total exceeds limit")
		}
		amount := item.PriceCopper * int64(line.Quantity)
		if result.TotalCopper > MaxCopper-amount {
			return Quote{}, errors.New("quote total exceeds limit")
		}
		result.TotalCopper += amount
		result.Lines = append(result.Lines, QuotedLine{ItemID: item.ID, Name: item.Name, UnitPriceCopper: item.PriceCopper, Quantity: line.Quantity, LineTotalCopper: amount})
	}
	return result, nil
}
