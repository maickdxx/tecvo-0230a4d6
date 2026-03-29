/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'

interface Props {
  userName?: string
  bodyText?: string
}

const CampaignRecoveryEmail: React.FC<Props> = ({ userName = '', bodyText = '' }) => {
  return React.createElement('html', { lang: 'pt-BR' },
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'UTF-8' }),
      React.createElement('meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' })
    ),
    React.createElement('body', { style: { margin: 0, padding: 0, backgroundColor: '#f4f4f5', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" } },
      React.createElement('table', { width: '100%', cellPadding: 0, cellSpacing: 0, style: { background: '#f4f4f5', padding: '40px 20px' } },
        React.createElement('tr', null,
          React.createElement('td', { align: 'center' },
            React.createElement('table', { width: 600, cellPadding: 0, cellSpacing: 0, style: { background: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } },
              React.createElement('tr', null,
                React.createElement('td', { style: { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', padding: '24px 40px', textAlign: 'center' } },
                  React.createElement('h1', { style: { color: '#ffffff', fontSize: '22px', margin: 0, fontWeight: 700 } }, 'Tecvo')
                )
              ),
              React.createElement('tr', null,
                React.createElement('td', { style: { padding: '32px 40px' } },
                  React.createElement('p', { style: { color: '#3f3f46', fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px' } },
                    bodyText || `Olá${userName ? ` ${userName}` : ''},\n\nVimos que você criou sua conta na Tecvo e gostaríamos de ajudar.\n\nA Tecvo pode simplificar a gestão da sua empresa — ordens de serviço, clientes, agenda e muito mais.`
                  ),
                  React.createElement('table', { cellPadding: 0, cellSpacing: 0, style: { margin: '24px auto' } },
                    React.createElement('tr', null,
                      React.createElement('td', { style: { background: '#2563eb', borderRadius: '8px', padding: '14px 32px' } },
                        React.createElement('a', { href: 'https://tecvo.com.br/dashboard', style: { color: '#ffffff', textDecoration: 'none', fontSize: '15px', fontWeight: 600 } }, 'Acessar a Tecvo →')
                      )
                    )
                  )
                )
              ),
              React.createElement('tr', null,
                React.createElement('td', { style: { background: '#fafafa', padding: '20px 40px', borderTop: '1px solid #e4e4e7', textAlign: 'center' } },
                  React.createElement('p', { style: { color: '#a1a1aa', fontSize: '12px', margin: 0 } },
                    'Tecvo — Gestão inteligente para empresas de serviço',
                    React.createElement('br'),
                    React.createElement('a', { href: 'https://tecvo.com.br', style: { color: '#2563eb', textDecoration: 'none' } }, 'tecvo.com.br')
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}

export const template: TemplateEntry = {
  component: CampaignRecoveryEmail,
  subject: (data) => data?.emailSubject || 'Precisando de ajuda com a Tecvo? 🤝',
  displayName: 'Campaign Recovery',
}
