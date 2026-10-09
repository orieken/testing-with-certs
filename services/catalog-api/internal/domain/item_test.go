package domain

import "testing"

func TestQuoteIsAuthoritativeAndAtomic(t *testing.T) {
	item := Item{ID: "wand", Name: "Wand", PriceCopper: 12000, Active: true}
	items := map[string]Item{"wand": item}
	quote, err := QuoteItems([]QuoteLine{{"wand", 2}}, items)
	if err != nil || quote.TotalCopper != 24000 || quote.Lines[0].UnitPriceCopper != 12000 {
		t.Fatalf("unexpected quote: %+v %v", quote, err)
	}
	if _, err = QuoteItems([]QuoteLine{{"wand", 1}, {"missing", 1}}, items); err == nil {
		t.Fatal("partial quote accepted")
	}
	item.Active = false
	items["wand"] = item
	if _, err = QuoteItems([]QuoteLine{{"wand", 1}}, items); err == nil {
		t.Fatal("archived item quoted")
	}
}
func TestItemValidation(t *testing.T) {
	valid := Fields{Name: "Wand", Description: "", Rarity: "Rare", Image: "/images/wand.png", PriceCopper: 1}
	if err := ValidateFields(valid); err != nil {
		t.Fatal(err)
	}
	valid.PriceCopper = -1
	if ValidateFields(valid) == nil {
		t.Fatal("negative price accepted")
	}
	valid.PriceCopper = 1
	valid.Image = "https://elsewhere.test/image.png"
	if ValidateFields(valid) == nil {
		t.Fatal("external image accepted")
	}
}
