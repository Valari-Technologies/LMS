-- The supplied ERD's `contents` table did not include a column for
-- *what to actually render* (the video file, the PDF, the external URL).
-- Per SRS section 82, this difference is documented here rather than
-- silently patched: content_type alone tells the frontend which player
-- to use, but the content still needs a reference to the actual asset.
--
-- Decision: add a single nullable `media_reference` column that holds
-- either a StorageService path (VIDEO/PDF/IMAGE/DOWNLOAD) or a raw URL
-- (EXTERNAL_LINK), rather than creating type-specific columns or a
-- separate join table — this keeps the common "what do I hand the
-- player" read as a single field, matching how `resources.url` already
-- represents the same concept for supplementary resources.

ALTER TABLE contents ADD COLUMN media_reference VARCHAR(500);
