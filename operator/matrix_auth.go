package main

// Auth type identifies the selection's login method, not a keyword in a test title
// and not proof that every recording performed a successful authentication.
type matrixAuthOption struct {
	ID, Label string
	Count     int
}

var matrixAuthKinds = []matrixAuthOption{
	{ID: "certificate", Label: "Certificate / mTLS"},
	{ID: "certificate-password", Label: "Certificate + password"},
	{ID: "password-totp", Label: "Password + TOTP"},
	{ID: "passkeys", Label: "Passkeys / WebAuthn"},
	{ID: "oidc", Label: "External OIDC"},
	{ID: "saml", Label: "SAML"},
	{ID: "kerberos", Label: "Kerberos / SPNEGO"},
	{ID: "unknown", Label: "Unspecified"},
}

func matrixAuthType(row matrixRow) string {
	if row.AuthType != "" {
		for _, kind := range matrixAuthKinds {
			if row.AuthType == kind.ID {
				return kind.ID
			}
		}
		return "unknown"
	}
	// Backward compatibility for the original certificate-shop matrix schema.
	for _, example := range matrixExamples() {
		if row.Suite == example.Suite && row.Runner == example.Runner && row.User == example.User {
			return "certificate"
		}
	}
	return "unknown"
}
func matrixAuthLabel(id string) string {
	for _, kind := range matrixAuthKinds {
		if id == kind.ID {
			return kind.Label
		}
	}
	return "Unspecified"
}
func matrixAuthOptions(rows []matrixGalleryRow) []matrixAuthOption {
	options := append([]matrixAuthOption(nil), matrixAuthKinds...)
	for i := range options {
		for _, row := range rows {
			if row.AuthType == options[i].ID {
				options[i].Count += len(row.Videos)
			}
		}
	}
	return options
}
