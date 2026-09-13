ALTER TABLE basis_snapshots ADD COLUMN IF NOT EXISTS asset_group text;

UPDATE basis_snapshots b
SET asset_group=a.asset_group
FROM assets a
WHERE a.id=b.asset_id AND b.asset_group IS DISTINCT FROM a.asset_group;

CREATE OR REPLACE FUNCTION set_basis_asset_group()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT asset_group INTO NEW.asset_group FROM assets WHERE id=NEW.asset_id;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS basis_asset_group_trigger ON basis_snapshots;
CREATE TRIGGER basis_asset_group_trigger
BEFORE INSERT OR UPDATE OF asset_id ON basis_snapshots
FOR EACH ROW EXECUTE FUNCTION set_basis_asset_group();

CREATE INDEX IF NOT EXISTS basis_asset_group_lookup_idx
ON basis_snapshots(asset_group,horizon_days,notional_usd,observed_at DESC);
