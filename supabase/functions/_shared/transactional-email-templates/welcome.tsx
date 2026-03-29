import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Tecvo"

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo à {SITE_NAME} — sua gestão começa agora!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          🚀 {name ? `Olá, ${name}!` : 'Bem-vindo!'}
        </Heading>
        <Text style={text}>
          Sua conta na <strong>{SITE_NAME}</strong> foi criada com sucesso.
        </Text>
        <Text style={text}>
          A Tecvo vai te ajudar a organizar seus serviços, clientes e financeiro em um só lugar.
          Comece agora mesmo!
        </Text>
        <Button style={button} href="https://tecvo.com.br/dashboard">
          Acessar a Tecvo →
        </Button>
        <Hr style={hr} />
        <Text style={footer}>
          Tecvo — Gestão inteligente para empresas de serviço
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: '🚀 Bem-vindo à Tecvo!',
  displayName: 'Boas-vindas',
  previewData: { name: 'João' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '32px 40px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#18181b', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3f3f46', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '14px 32px',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
  margin: '8px 0 24px',
}
const hr = { borderColor: '#e4e4e7', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#a1a1aa', margin: '0', textAlign: 'center' as const }
