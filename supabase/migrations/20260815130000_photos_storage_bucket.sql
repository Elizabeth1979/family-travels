-- Storage bucket for photo uploads.
--
-- Applied to project `family-travels` (ref vsxbedlsnfmsbnlfayae) on 2026-08-15.
-- Committed so the repo matches the database — the bucket and its policies
-- otherwise exist only in the hosted project, which is the drift this
-- migrations directory is here to prevent.
--
-- Note: nothing in the site uploads to this bucket yet. The legacy archive
-- still serves its bytes from the Google CDN via `photos.url`; this bucket is
-- groundwork for in-app uploads (plan Phase 5).
--
-- Public read: the album pages serve <img src> directly, exactly as they do for
-- the legacy Google CDN URLs, so no signed-URL plumbing is needed.
--
-- file_size_limit is deliberately small: uploads are meant to be resized in the
-- browser first (~2000px long edge). A 5 MB ceiling is generous for that, and is
-- what keeps a 500-photo library inside the free tier — full-size originals
-- would blow well past it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are namespaced by owner: photos/<owner_uuid>/<album_slug>/<file>.
-- The first path segment must equal the uploader's uid, which is what stops one
-- user writing into another user's folder once there is more than one user.

drop policy if exists photos_bucket_public_read on storage.objects;
create policy photos_bucket_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists photos_bucket_owner_insert on storage.objects;
create policy photos_bucket_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists photos_bucket_owner_update on storage.objects;
create policy photos_bucket_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists photos_bucket_owner_delete on storage.objects;
create policy photos_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
