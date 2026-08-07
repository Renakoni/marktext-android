package io.github.renakoni.marktextandroid;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/**
 * A minimal in-test {@link ContentProvider} that maps a {@code content://} URI
 * to a real file under the app cache dir. It lets the instrumentation smoke
 * tests exercise the genuine {@link android.content.ContentResolver} I/O paths
 * ({@code openInputStream} / {@code openFileDescriptor}) — the parts a JVM unit
 * test cannot reach — without driving the system DocumentsUI picker, which is a
 * separate process and varies by API level.
 *
 * <p>Registered only in the androidTest manifest, so it never ships in the app.
 */
public final class TestDocumentProvider extends ContentProvider {

    static final String AUTHORITY = "io.github.renakoni.marktextandroid.test.documents";

    /** A content URI whose last path segment is the backing file name. */
    static Uri uriFor(String fileName) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(fileName).build();
    }

    private File fileFor(Uri uri) {
        File dir = new File(getContext().getCacheDir(), "test-docs");
        dir.mkdirs();
        return new File(dir, uri.getLastPathSegment());
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        // Honor the exact mode the caller asked for ("r", "rwt", "wt", ...) so
        // ContentResolverDocumentIo's real truncate/read-write handling runs.
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.parseMode(mode));
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        MatrixCursor cursor = new MatrixCursor(new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        cursor.addRow(new Object[] {uri.getLastPathSegment(), fileFor(uri).length()});
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "text/markdown";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return fileFor(uri).delete() ? 1 : 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
