-- Release 2. Organization types moved from the placeholders "type1"/"type2" to
-- real legal forms. The placeholders say nothing about what a business actually
-- is, so they are cleared rather than guessed; admins choose a real type in
-- Settings -> Company. Organization.orgType is TEXT, so no type change is needed.
--
-- Release-1 code already treats these values as unset, so this is cleanup, not
-- a fix. Export (id, name, orgType) before running this.
UPDATE "Organization" SET "orgType" = NULL WHERE "orgType" IN ('type1', 'type2');
