-- ============================================================
-- 032 Avatars storage bucket: per-user write policies
--
-- Fixes:
--   The public `avatars` bucket (001_initial_schema.sql) had an INSERT
--   policy "Authenticated users can upload avatars" that only checked
--   auth.role() = 'authenticated'. Every signed-in user, including
--   open-access guests, could therefore write any object anywhere in the
--   bucket, e.g. under another user's folder. The UPDATE and DELETE
--   policies were already folder-scoped but had no WITH CHECK, so an
--   update could move an object into another user's folder.
--
--   The three write policies are replaced by per-command policies that
--   require the object to live in the caller's own folder:
--
--     own = bucket_id = 'avatars'
--           AND (storage.foldername(name))[1] = auth.uid()::text
--
--   Command   Before                      After
--   INSERT    any authenticated user      own (WITH CHECK)
--   UPDATE    own (USING only)            own (USING and WITH CHECK)
--   DELETE    own                         own
--   SELECT    public                      public (unchanged)
--
--   Mapping to code: uploadAvatar / removeAvatar (lib/actions/profile.ts)
--   write to `${user.id}/...` with the user-scoped client, so they satisfy
--   the new policies. Service-role writers bypass RLS and are unaffected.
--
-- Safe to re-run: every CREATE POLICY is preceded by DROP POLICY IF EXISTS,
-- and the 001 policy names are dropped as well.
-- Apply by hand in the Supabase SQL editor (paste the whole file, Run).
-- App code is safe before and after applying.
-- ============================================================


-- ─── Drop the 001 write policies ────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars"           ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars"           ON storage.objects;


-- ─── Per-user write policies ────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─── Public read (unchanged from 001; recreated so a re-run is complete) ────

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');


-- ─── Verification (comments only -- not executed) ──────────────────────────
--
-- Expect exactly four avatars policies (select/insert/update/delete):
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND (qual LIKE '%avatars%' OR with_check LIKE '%avatars%')
--   ORDER BY cmd;
