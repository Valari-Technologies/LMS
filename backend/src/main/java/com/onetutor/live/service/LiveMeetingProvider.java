package com.onetutor.live.service;

/**
 * Integration boundary for the (currently undecided) conferencing
 * provider — SRS section 36. For MVP, the only implementation is
 * StaticUrlMeetingProvider, which just stores/returns the
 * admin-configured meeting URL. Future implementations (Zoom,
 * Google Meet, Teams) plug in here without touching LiveSessionService.
 */
public interface LiveMeetingProvider {
    /** Returns the URL a participant should use to join. */
    String getJoinUrl(String configuredMeetingUrl);
}
