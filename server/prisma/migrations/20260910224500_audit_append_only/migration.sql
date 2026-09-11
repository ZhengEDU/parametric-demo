-- Enforce append-only AuditEvent at the database level, independent of the
-- application layer. Even a bug or a compromised app-tier credential cannot
-- silently edit or erase audit history — the trigger raises and aborts the
-- transaction. See docs/SECURITY.md.

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are append-only and cannot be % (id=%)', TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update
BEFORE UPDATE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TRIGGER audit_event_no_delete
BEFORE DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
