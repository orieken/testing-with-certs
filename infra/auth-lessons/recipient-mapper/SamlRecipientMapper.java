package lab.auth;

import java.util.ArrayList;
import java.util.List;
import org.keycloak.broker.provider.AbstractIdentityProviderMapper;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityBrokerException;
import org.keycloak.broker.saml.SAMLEndpoint;
import org.keycloak.dom.saml.v2.assertion.AssertionType;
import org.keycloak.dom.saml.v2.assertion.SubjectConfirmationType;
import org.keycloak.models.IdentityProviderMapperModel;
import org.keycloak.models.IdentityProviderSyncMode;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.provider.ProviderConfigProperty;

/** Lesson broker defense after Keycloak verifies the assertion's signature and conditions. */
public final class SamlRecipientMapper extends AbstractIdentityProviderMapper {
    public static final String ID = "lesson-saml-recipient";
    @Override public String getId() { return ID; }
    @Override public String[] getCompatibleProviders() { return new String[] { "saml" }; }
    @Override public String getDisplayCategory() { return "Lesson validation"; }
    @Override public String getDisplayType() { return "Require exact SAML recipient"; }
    @Override public String getHelpText() { return "Reject a bearer assertion unless its subject recipient equals this broker endpoint."; }
    @Override public boolean supportsSyncMode(IdentityProviderSyncMode mode) { return true; }
    @Override public List<ProviderConfigProperty> getConfigProperties() {
        ProviderConfigProperty property = new ProviderConfigProperty();
        property.setName("recipient");
        property.setLabel("Exact recipient");
        property.setType(ProviderConfigProperty.STRING_TYPE);
        property.setHelpText("The broker's exact HTTPS assertion-consumer endpoint.");
        return List.of(property);
    }
    @Override public void preprocessFederatedIdentity(KeycloakSession session, RealmModel realm,
            IdentityProviderMapperModel model, BrokeredIdentityContext context) {
        String expected = model.getConfig().get("recipient");
        Object value = context.getContextData().get(SAMLEndpoint.SAML_ASSERTION);
        if (expected == null || !expected.startsWith("https://") || !(value instanceof AssertionType assertion)
                || assertion.getSubject() == null) {
            throw new IdentityBrokerException("SAML subject confirmation rejected");
        }
        var subject = assertion.getSubject();
        var confirmations = new ArrayList<SubjectConfirmationType>(subject.getConfirmation());
        if (subject.getSubType() != null) confirmations.addAll(subject.getSubType().getConfirmation());
        if (confirmations.size() != 1) throw new IdentityBrokerException("SAML subject confirmation rejected");
        var confirmation = confirmations.get(0);
        var data = confirmation.getSubjectConfirmationData();
        if (!"urn:oasis:names:tc:SAML:2.0:cm:bearer".equals(String.valueOf(confirmation.getMethod()))
                || data == null || !expected.equals(String.valueOf(data.getRecipient()))) {
            throw new IdentityBrokerException("SAML subject confirmation rejected");
        }
    }
}
