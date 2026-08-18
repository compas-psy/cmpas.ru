// Shape shared between the client-facing booking page and the server-side
// tracking action — kept free of any server-only import (Prisma, fs) so it
// stays safe to pull into a 'use client' bundle.

export type BookingChannel = 'telegram' | 'max' | 'browser';
export type BookingLinkType = 'general' | 'personal';

export type BookingFunnelStep =
    | 'booking_link_opened'
    | 'booking_time_selected'
    | 'booking_form_started'
    | 'booking_consent_shown'
    | 'booking_completed';

export interface BookingFunnelContext {
    channel: BookingChannel;
    linkType: BookingLinkType;
    knownClient: boolean;
}

export type BookingCreatedBy = 'client' | 'specialist';
