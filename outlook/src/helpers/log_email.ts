import { Email } from '../models/email'
import { ErrorMessage } from '../models/error_message'
import API from './api'
import { postJsonRpc } from './http'
import { _t } from './translate'

function escapeHtml(value: string): string {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function getSafeOdooHost(): string {
    try {
        const odooUrl = localStorage.getItem('odoo_url') || ''
        return odooUrl ? new URL(odooUrl).host : 'unknown-odoo'
    } catch {
        return 'unknown-odoo'
    }
}

/**
 * Return how many times the current email has already been logged
 * on the given record.
 */
export function getLoggedCount(
    recordId: number,
    recordModel: string,
    email: Email
): number {
    const baseUrl = getSafeOdooHost()
    const loggedState: string[] = JSON.parse(
        localStorage.getItem('logged_state') || '[]'
    )

    const keyPrefix = `${baseUrl}-${recordId}-${recordModel}-${email.messageId}-`

    return loggedState.filter((key) => key.startsWith(keyPrefix)).length
}

/**
 * Format the email body before sending it to Odoo.
 */
async function _formatEmailBody(
    email: Email,
    error: boolean,
    loggedCount: number
): Promise<string> {
    const body = await email.getBody()
    const loggedAt = new Date().toLocaleString('cs-CZ')

    const themes = [
        {
            background: '#eaf8fc',
            border: '#9fd3e3',
            title: '📧 E-mail z Outlooku',
        },
        {
            background: '#fff7df',
            border: '#f0c36d',
            title: '📧 E-mail z Outlooku · opakované vložení',
        },
        {
            background: '#f4edff',
            border: '#c7a8f5',
            title: '📧 E-mail z Outlooku · opakované vložení',
        },
        {
            background: '#edf9ef',
            border: '#9bd3a8',
            title: '📧 E-mail z Outlooku · opakované vložení',
        },
    ]

    const theme = themes[loggedCount % themes.length]
    const insertLabel =
        loggedCount === 0
            ? `vloženo ${loggedAt}`
            : `vloženo znovu č. ${loggedCount + 1} · ${loggedAt}`

    const cc = email.emailCC
        ? `<div><strong>Cc:</strong> ${escapeHtml(email.emailCC)}</div>`
        : ''

    const warning = error
        ? `<div style="margin-top: 14px; color: #875A7B;">
                <em>${escapeHtml(
                    _t(
                        'Attachments could not be logged in Odoo because their total size exceeded the allowed maximum.'
                    )
                )}</em>
           </div>`
        : ''

    return `
        <div class="o_mail_plugin_logged_email" style="margin: 10px 0;">
            <div style="border: 1px solid ${theme.border}; background: ${theme.background}; border-radius: 12px; padding: 22px; margin: 16px 0;">
                <div style="font-weight: 600; color: #3f4d55; font-size: 15px; margin-bottom: 14px;">
                    ${theme.title} · ${escapeHtml(insertLabel)}
                </div>

                <div style="background: #ffffff; border: 1px solid #d8e2e7; border-radius: 8px; padding: 16px; margin-bottom: 12px; font-size: 13px; color: #555; line-height: 1.45;">
                    <div><strong>From:</strong> ${escapeHtml(email.emailFrom)}</div>
                    <div><strong>To:</strong> ${escapeHtml(email.emailTo)}</div>
                    ${cc}
                    <div><strong>Subject:</strong> ${escapeHtml(email.subject)}</div>
                </div>

                <div class="o_mail_plugin_logged_email_body" style="background: #ffffff; border: 1px solid #d8e2e7; border-radius: 8px; padding: 22px; line-height: 1.5;">
                    ${body}
                </div>

                ${warning}
            </div>
        </div>
    `
}

/**
 * Log the given email body in the chatter of the given record.
 */
export async function logEmail(
    recordId: number,
    recordModel: string,
    email: Email,
    partnerIdToFollow?: number
): Promise<ErrorMessage> {
    const attachments = await email.getAttachments()
    const loggedCount = getLoggedCount(recordId, recordModel, email)
    const body = await _formatEmailBody(
        email,
        attachments === null,
        loggedCount
    )

    const response = await postJsonRpc(API.LOG_EMAIL, {
        body,
        subject: email.subject,
        email_from: email.emailFrom,
        email_to: email.emailTo,
        email_cc: email.emailCC,
        timestamp: email.timestamp,
        res_id: recordId,
        model: recordModel,
        attachments: attachments,
        application_name: _t('Odoo for Outlook'),
        partner_id_to_follow: partnerIdToFollow,
    })

    const error = new ErrorMessage()

    if (!response) {
        error.setError('unknown')
    } else {
        setLoggedState(recordId, recordModel, email)
    }

    return error
}

/**
 * Store a local history entry.
 *
 * We intentionally include current time in the key, so the same email can be
 * logged multiple times on the same record. Each chatter message is visually
 * distinguished by color, timestamp and repeated insert number.
 */
function setLoggedState(recordId: number, recordModel: string, email: Email) {
    const baseUrl = getSafeOdooHost()
    let loggedState: string[] = JSON.parse(
        localStorage.getItem('logged_state') || '[]'
    )

    const insertedAt = new Date().toISOString()
    const key = `${baseUrl}-${recordId}-${recordModel}-${email.messageId}-${insertedAt}`

    loggedState.push(key)

    if (loggedState.length > 5000) {
        loggedState = loggedState.slice(
            loggedState.length - 5000,
            loggedState.length
        )
    }

    localStorage.setItem('logged_state', JSON.stringify(loggedState))
}

/**
 * Return true if the current email has been logged on the given record.
 *
 * Important: we return false so the same email can be logged again.
 * Repeated logs are visually distinguished in the generated chatter body.
 */
export function getLoggedState(
    _recordId: number,
    _recordModel: string,
    _email: Email
): boolean {
    return false
}
