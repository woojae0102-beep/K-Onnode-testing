// @ts-nocheck
// Discover content is fetched live from YouTube via /api/discover.
// No hardcoded sample videos — when the API has not responded yet, the UI
// shows a loading state. When the API key is missing OR the request fails,
// the UI shows an explicit empty/error state.

export function fetchMockDiscover() {
  return {
    trending: [],
    dance: [],
    songs: [],
    challenges: [],
    lastUpdated: null,
    source: 'loading',
  };
}
