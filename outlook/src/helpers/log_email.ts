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

    const isRepeated = loggedCount > 0

    const themes = [
        {
            outerBackground: '#dff5fb',
            outerBorder: '#1496b8',
            headerBackground: '#1496b8',
            sectionBorder: '#74c7dc',
            accent: '#1496b8',
        },
        {
            outerBackground: '#fff4d6',
            outerBorder: '#d99a16',
            headerBackground: '#d99a16',
            sectionBorder: '#e9bf66',
            accent: '#d99a16',
        },
        {
            outerBackground: '#f0e7ff',
            outerBorder: '#8b5bd6',
            headerBackground: '#8b5bd6',
            sectionBorder: '#b99aea',
            accent: '#8b5bd6',
        },
        {
            outerBackground: '#e7f8ec',
            outerBorder: '#3b9f57',
            headerBackground: '#3b9f57',
            sectionBorder: '#8dd39f',
            accent: '#3b9f57',
        },
    ]

    const theme = themes[loggedCount % themes.length]

    const title = isRepeated
        ? '📧 E-mail z Outlooku · opakované vložení'
        : '📧 E-mail z Outlooku'

    const insertLabel = isRepeated
        ? `Vloženo znovu č. ${loggedCount + 1} · ${loggedAt}`
        : `Vloženo ${loggedAt}`

    const cc = email.emailCC
        ? `
            <div style="height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</div>
            <div><strong>Cc:</strong> ${escapeHtml(email.emailCC)}</div>
        `
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

    const spacerSmall =
        '<div style="height: 10px; line-height: 10px; font-size: 1px;">&nbsp;</div>'
    const spacerMedium =
        '<div style="height: 18px; line-height: 18px; font-size: 1px;">&nbsp;</div>'

    return `
        <div class="o_mail_plugin_logged_email" style="
            display: block;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            margin: 14px 0 18px 0;
            padding: 0;
            color: #263238;
        ">
            <div style="
                background: ${theme.outerBackground};
                border: 4px solid ${theme.outerBorder};
                border-radius: 14px;
                padding: 20px;
                box-sizing: border-box;
                width: 100%;
                max-width: 100%;
            ">
                <div style="
                    background: ${theme.headerBackground};
                    color: #ffffff;
                    border-radius: 9px;
                    padding: 12px 16px;
                    font-size: 15px;
                    line-height: 1.45;
                    font-weight: 700;
                ">
                    ${title}

                    <div style="height: 6px; line-height: 6px; font-size: 1px;">&nbsp;</div>

                    <div style="
                        font-size: 12px;
                        line-height: 1.35;
                        font-weight: 500;
                        color: #eefaff;
                    ">
                        ${escapeHtml(insertLabel)}
                    </div>
                </div>

                ${spacerMedium}

                <div style="
                    background: #ffffff;
                    border: 2px solid ${theme.sectionBorder};
                    border-left: 7px solid ${theme.accent};
                    border-radius: 10px;
                    padding: 16px 18px;
                    font-size: 13px;
                    color: #263238;
                    line-height: 1.6;
                    box-sizing: border-box;
                ">
                    <div style="font-weight: 700; color: #294b59;">
                        Informace o e-mailu
                    </div>

                    ${spacerSmall}

                    <div><strong>Od:</strong> ${escapeHtml(email.emailFrom)}</div>
                    <div style="height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</div>
                    <div><strong>Komu:</strong> ${escapeHtml(email.emailTo)}</div>
                    ${cc}
                    <div style="height: 5px; line-height: 5px; font-size: 1px;">&nbsp;</div>
                    <div><strong>Předmět:</strong> ${escapeHtml(email.subject)}</div>
                </div>

                ${spacerMedium}

                <div style="
                    font-weight: 700;
                    color: #294b59;
                    font-size: 13px;
                ">
                    Obsah e-mailu
                </div>

                ${spacerSmall}

                <div class="o_mail_plugin_logged_email_body" style="
                    background: #ffffff;
                    border: 2px solid ${theme.sectionBorder};
                    border-left: 7px solid ${theme.accent};
                    border-radius: 10px;
                    padding: 24px 26px;
                    color: #1f2933;
                    font-size: 13px;
                    line-height: 1.7;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                    box-sizing: border-box;
                    min-height: 70px;
                ">
                    ${body}
                </div>

                ${warning ? spacerMedium : ''}
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
