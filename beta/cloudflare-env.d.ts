declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ASSETS?: Fetcher;
    BUCKET?: R2Bucket;
    MINIMAX_API_KEY?: string;
    MINIMAX_MODEL?: string;
    INWORLD_API_KEY?: string;
    HYPERGREEN_REVIEWER_EMAILS?: string;
  }
}
