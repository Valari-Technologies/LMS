package com.onetutor.live.service;

import org.springframework.stereotype.Service;

/** MVP implementation: the admin supplies the meeting URL directly. */
@Service
public class StaticUrlMeetingProvider implements LiveMeetingProvider {
    @Override
    public String getJoinUrl(String configuredMeetingUrl) {
        return configuredMeetingUrl;
    }
}
