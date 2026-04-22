import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'PEC Nexus'
const APP_URL = 'https://pecnexus.com/app/events'

type Kind = 'created' | 'updated' | 'cancelled'

interface EventNotificationProps {
  kind?: Kind
  title?: string
  date?: string
  time?: string
  location?: string | null
  link?: string | null
  description?: string | null
  hostName?: string | null
  audienceLabel?: string | null
  preparation?: string | null
  changesSummary?: string | null
  cancellationReason?: string | null
  recipientName?: string | null
  eventUrl?: string
}

const labelFor = (k: Kind) =>
  k === 'cancelled' ? 'CANCELLED' : k === 'updated' ? 'UPDATED' : 'NEW EVENT'

const EventNotificationEmail = ({
  kind = 'created',
  title = 'PEC Event',
  date = '',
  time = '',
  location,
  link,
  description,
  hostName,
  audienceLabel,
  preparation,
  changesSummary,
  cancellationReason,
  recipientName,
  eventUrl = APP_URL,
}: EventNotificationProps) => {
  const isCancelled = kind === 'cancelled'
  const isUpdated = kind === 'updated'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isCancelled ? `Cancelled: ${title}` : isUpdated ? `Updated: ${title}` : title}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={kicker(kind)}>{labelFor(kind)}</Text>
            <Heading style={h1}>{title}</Heading>
            {recipientName ? <Text style={greeting}>Hi {recipientName},</Text> : null}

            {isCancelled && (
              <Text style={alertBox}>
                This event has been cancelled. {cancellationReason ? `Reason: ${cancellationReason}` : ''}
              </Text>
            )}
            {isUpdated && changesSummary && (
              <Text style={updateBox}>
                <strong>What changed:</strong> {changesSummary}
              </Text>
            )}

            <Section style={detailsBox}>
              {date && (
                <Text style={detailLine}><strong>Date:</strong> {date}</Text>
              )}
              {time && (
                <Text style={detailLine}><strong>Time:</strong> {time}</Text>
              )}
              {location && (
                <Text style={detailLine}><strong>Location:</strong> {location}</Text>
              )}
              {link && (
                <Text style={detailLine}><strong>Meeting link:</strong> {link}</Text>
              )}
              {hostName && (
                <Text style={detailLine}><strong>Host:</strong> {hostName}</Text>
              )}
              {audienceLabel && (
                <Text style={detailLine}><strong>For:</strong> {audienceLabel}</Text>
              )}
            </Section>

            {description && (
              <>
                <Heading as="h2" style={h2}>Details</Heading>
                <Text style={text}>{description}</Text>
              </>
            )}
            {preparation && (
              <>
                <Heading as="h2" style={h2}>Please prepare</Heading>
                <Text style={text}>{preparation}</Text>
              </>
            )}

            {!isCancelled && (
              <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
                <Button href={eventUrl} style={button}>Open in {SITE_NAME}</Button>
              </Section>
            )}

            <Hr style={hr} />
            <Text style={footer}>
              Sent by {SITE_NAME} — Poly-Engineering Consulting at Cal Poly SLO.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventNotificationEmail,
  subject: (d: Record<string, any>) => {
    const t = d?.title || 'PEC event'
    if (d?.kind === 'cancelled') return `Cancelled: ${t}`
    if (d?.kind === 'updated') return `Updated: ${t}`
    return `${t} — ${SITE_NAME}`
  },
  displayName: 'Event notification',
  previewData: {
    kind: 'created',
    title: 'Hardware cohort sync',
    date: 'Mon, May 6 2026',
    time: '6:00–7:00 PM',
    location: 'Bonderson 187',
    hostName: 'Amogh Somisetty',
    audienceLabel: 'Hardware cohort',
    description: 'Weekly hardware cohort sync — bring blockers and updates.',
    recipientName: 'Jane',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { padding: '28px 24px', maxWidth: 560, margin: '0 auto' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#0f1d1f', margin: '4px 0 16px', lineHeight: 1.25 }
const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#0f1d1f', margin: '20px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const greeting: React.CSSProperties = { fontSize: '14px', color: '#374151', margin: '0 0 12px' }
const kicker = (k: Kind): React.CSSProperties => ({
  fontSize: '11px',
  letterSpacing: '0.12em',
  fontWeight: 700,
  color: k === 'cancelled' ? '#b91c1c' : k === 'updated' ? '#a16207' : '#0f766e',
  margin: 0,
})
const text: React.CSSProperties = { fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: '0 0 12px' }
const detailsBox: React.CSSProperties = { background: '#f7f7f5', borderRadius: '10px', padding: '14px 16px', margin: '14px 0 8px' }
const detailLine: React.CSSProperties = { fontSize: '13px', color: '#1f2937', margin: '4px 0', lineHeight: 1.5 }
const alertBox: React.CSSProperties = { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', margin: '10px 0 14px' }
const updateBox: React.CSSProperties = { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', margin: '10px 0 14px' }
const button: React.CSSProperties = { background: '#0f766e', color: '#ffffff', textDecoration: 'none', padding: '12px 22px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }
const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer: React.CSSProperties = { fontSize: '11px', color: '#9ca3af', margin: 0 }