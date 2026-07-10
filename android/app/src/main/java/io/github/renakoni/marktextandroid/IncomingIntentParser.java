package io.github.renakoni.marktextandroid;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import java.util.Locale;
import java.util.Set;

/**
 * Parses and classifies incoming ACTION_VIEW / ACTION_SEND intents into
 * structured results: which pipeline handles them (open-with document,
 * shared Markdown stream, shared text) or why they are rejected. Owns the
 * MIME/extension candidate rules shared with the document read paths. Does
 * not touch UI, events, or document persistence — the plugin dispatches on
 * the returned result.
 */
final class IncomingIntentParser {

    private static final String TAG = "MarkTextAndroid";

    enum Kind {
        IGNORED,
        OPEN_WITH_DOCUMENT,
        SHARE_STREAM,
        SHARE_TEXT,
        REJECTED_OPEN_WITH,
        REJECTED_SHARE,
    }

    static final class Result {

        final Kind kind;
        final Uri uri;
        final String text;
        final String mimeType;
        final String rawTitle;
        final String code;
        final String message;

        private Result(
            Kind kind,
            Uri uri,
            String text,
            String mimeType,
            String rawTitle,
            String code,
            String message
        ) {
            this.kind = kind;
            this.uri = uri;
            this.text = text;
            this.mimeType = mimeType;
            this.rawTitle = rawTitle;
            this.code = code;
            this.message = message;
        }

        private static Result ignored() {
            return new Result(Kind.IGNORED, null, null, null, null, null, null);
        }

        private static Result openWithDocument(Uri uri) {
            return new Result(Kind.OPEN_WITH_DOCUMENT, uri, null, null, null, null, null);
        }

        private static Result shareStream(Uri uri) {
            return new Result(Kind.SHARE_STREAM, uri, null, null, null, null, null);
        }

        private static Result shareText(String text, String mimeType, String rawTitle) {
            return new Result(Kind.SHARE_TEXT, null, text, mimeType, rawTitle, null, null);
        }

        private static Result rejectedOpenWith(String code, String message) {
            return new Result(Kind.REJECTED_OPEN_WITH, null, null, null, null, code, message);
        }

        private static Result rejectedShare(String code, String message) {
            return new Result(Kind.REJECTED_SHARE, null, null, null, null, code, message);
        }
    }

    private IncomingIntentParser() {}

    static boolean isIncomingAction(String action) {
        return (
            Intent.ACTION_VIEW.equals(action) ||
            Intent.ACTION_SEND.equals(action) ||
            Intent.ACTION_SEND_MULTIPLE.equals(action)
        );
    }

    static Result parse(Intent intent) {
        if (intent == null) {
            return Result.ignored();
        }

        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) {
            return parseOpenWith(intent);
        }
        if (Intent.ACTION_SEND.equals(action)) {
            return parseShare(intent);
        }
        if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            Log.w(TAG, "Rejected Android multi-share intent");
            return Result.rejectedShare("UNSUPPORTED_SHARE_DOCUMENT", "Share one Markdown file at a time");
        }
        return Result.ignored();
    }

    private static Result parseOpenWith(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null) {
            return Result.rejectedOpenWith("DOCUMENT_URI_MISSING", "Android open-with intent returned no URI");
        }

        if (!hasOnlyAllowedViewCategories(intent)) {
            Log.w(TAG, "Rejected Android open-with intent with unsupported categories");
            return Result.rejectedOpenWith("INVALID_OPEN_WITH_INTENT", "This Android open-with request is not supported");
        }

        if (!"content".equals(uri.getScheme())) {
            Log.w(TAG, "Rejected Android open-with URI with unsupported scheme: " + safeForLog(uri.getScheme()));
            return Result.rejectedOpenWith("INVALID_SOURCE_URI", "A valid content URI is required");
        }

        return Result.openWithDocument(uri);
    }

    private static Result parseShare(Intent intent) {
        if (!hasOnlyAllowedShareCategories(intent)) {
            Log.w(TAG, "Rejected Android share intent with unsupported categories");
            return Result.rejectedShare("INVALID_SHARE_INTENT", "This Android share request is not supported");
        }

        Uri streamUri;
        try {
            streamUri = getSharedStreamUri(intent);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share stream extra rejected: " + ex.getMessage());
            return Result.rejectedShare(ex.code, ex.getMessage());
        }

        if (streamUri != null) {
            if (!"content".equals(streamUri.getScheme())) {
                Log.w(TAG, "Rejected Android shared URI with unsupported scheme: " + safeForLog(streamUri.getScheme()));
                return Result.rejectedShare(
                    "INVALID_SHARE_SOURCE_URI",
                    "This Android share did not provide a supported file URI"
                );
            }
            return Result.shareStream(streamUri);
        }

        CharSequence sharedText;
        try {
            sharedText = getSharedText(intent);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android share text extra rejected: " + ex.getMessage());
            return Result.rejectedShare(ex.code, ex.getMessage());
        }

        if (sharedText != null && sharedText.length() > 0) {
            return parseSharedText(sharedText.toString(), intent);
        }

        return Result.rejectedShare("SHARE_CONTENT_MISSING", "This Android share did not include Markdown content");
    }

    private static Result parseSharedText(String markdown, Intent intent) {
        String mimeType = normalizeMimeType(intent.getType());
        if (!isSharedTextMimeType(mimeType)) {
            Log.w(TAG, "Rejected Android shared text with unsupported MIME type: " + safeForLog(mimeType));
            return Result.rejectedShare("UNSUPPORTED_SHARE_DOCUMENT", "Share Markdown text or a Markdown file");
        }

        try {
            MarkdownCodec.validateBytes(markdown);
        } catch (DocumentReadException ex) {
            Log.w(TAG, "Android shared text rejected: " + ex.getMessage());
            return Result.rejectedShare(ex.code, ex.getMessage());
        }

        return Result.shareText(markdown, mimeType, getSharedTextRawTitle(intent));
    }

    /** EXTRA_TITLE, then EXTRA_SUBJECT, then a fixed fallback — un-normalized. */
    private static String getSharedTextRawTitle(Intent intent) {
        CharSequence titleValue = getOptionalCharSequenceExtra(intent, Intent.EXTRA_TITLE);
        String title = titleValue == null ? "" : titleValue.toString();
        CharSequence subjectValue = getOptionalCharSequenceExtra(intent, Intent.EXTRA_SUBJECT);
        if (title.trim().length() == 0 && subjectValue != null) {
            title = subjectValue.toString();
        }
        if (title == null || title.trim().length() == 0) {
            title = "Shared Markdown";
        }
        return title;
    }

    // ------------------------------------------------------- classification

    static boolean isMarkdownCandidate(String displayName, String mimeType) {
        if (hasMarkdownExtension(displayName)) {
            return true;
        }

        return (
            isMarkdownMimeType(mimeType) ||
            "text/plain".equals(mimeType)
        );
    }

    static boolean isOpenWithMarkdownCandidate(Uri uri, String displayName, String mimeType) {
        return (
            hasMarkdownExtension(displayName) ||
            hasMarkdownExtension(uri.getLastPathSegment()) ||
            isMarkdownMimeType(mimeType)
        );
    }

    static boolean isSharedStreamMarkdownCandidate(Uri uri, String displayName, String mimeType) {
        return (
            hasMarkdownExtension(displayName) ||
            hasMarkdownExtension(uri.getLastPathSegment()) ||
            isMarkdownMimeType(mimeType)
        );
    }

    static boolean hasMarkdownExtension(String value) {
        String lowerName = value == null ? "" : value.toLowerCase(Locale.US);
        return (
            lowerName.endsWith(".md") ||
            lowerName.endsWith(".markdown") ||
            lowerName.endsWith(".mdown") ||
            lowerName.endsWith(".mkdn") ||
            lowerName.endsWith(".mkd")
        );
    }

    static boolean isMarkdownMimeType(String mimeType) {
        return (
            "text/markdown".equals(mimeType) ||
            "text/x-markdown".equals(mimeType) ||
            "text/vnd.daringfireball.markdown".equals(mimeType)
        );
    }

    static boolean isSharedTextMimeType(String mimeType) {
        return (
            mimeType.length() == 0 ||
            "text/plain".equals(mimeType) ||
            mimeType.startsWith("text/") ||
            isMarkdownMimeType(mimeType)
        );
    }

    static String normalizeMimeType(String mimeType) {
        return mimeType == null ? "" : mimeType.toLowerCase(Locale.US);
    }

    // ------------------------------------------------------------ internals

    @SuppressWarnings("deprecation")
    private static CharSequence getSharedText(Intent intent) throws DocumentReadException {
        try {
            return intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        } catch (RuntimeException ex) {
            throw new DocumentReadException(
                "INVALID_SHARE_INTENT",
                "This Android share request is not supported"
            );
        }
    }

    private static CharSequence getOptionalCharSequenceExtra(Intent intent, String key) {
        try {
            return intent.getCharSequenceExtra(key);
        } catch (RuntimeException ex) {
            Log.w(TAG, "Ignored malformed Android share text metadata: " + safeForLog(key));
            return null;
        }
    }

    private static Uri getSharedStreamUri(Intent intent) throws DocumentReadException {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            }
            return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } catch (RuntimeException ex) {
            throw new DocumentReadException(
                "INVALID_SHARE_INTENT",
                "This Android share request is not supported"
            );
        }
    }

    private static boolean hasOnlyAllowedViewCategories(Intent intent) {
        Set<String> categories = intent.getCategories();
        if (categories == null) {
            return true;
        }

        for (String category : categories) {
            if (
                !Intent.CATEGORY_DEFAULT.equals(category) &&
                !Intent.CATEGORY_BROWSABLE.equals(category) &&
                !Intent.CATEGORY_OPENABLE.equals(category)
            ) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasOnlyAllowedShareCategories(Intent intent) {
        Set<String> categories = intent.getCategories();
        if (categories == null) {
            return true;
        }

        for (String category : categories) {
            if (!Intent.CATEGORY_DEFAULT.equals(category)) {
                return false;
            }
        }
        return true;
    }

    private static String safeForLog(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\r', ' ').replace('\n', ' ').trim();
    }
}
