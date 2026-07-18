-- Invocation identifiers originate outside the database and are not globally
-- unique. Scope audit upserts to the authenticated tenant and user so one
-- actor cannot overwrite another actor's audit metadata.
DROP INDEX "tool_invocations_source_invocation_id_key";

CREATE UNIQUE INDEX "tool_invocations_tenant_id_user_id_source_invocation_id_key"
ON "tool_invocations"("tenant_id", "user_id", "source", "invocation_id");
