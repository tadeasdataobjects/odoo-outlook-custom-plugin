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
function extractEmailAddresses(value: string): string[] {
    return (
        (value || '')
            .toLowerCase()
            .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []
    )
}

function getCurrentMailboxEmail(): string {
    try {
        return (
            Office.context.mailbox.userProfile.emailAddress || ''
        ).toLowerCase()
    } catch {
        return ''
    }
}

function getEmailDirection(email: Email): 'incoming' | 'outgoing' {
    const mailboxEmail = getCurrentMailboxEmail()
    const fromEmails = extractEmailAddresses(email.emailFrom)

    if (mailboxEmail && fromEmails.includes(mailboxEmail)) {
        return 'outgoing'
    }

    return 'incoming'
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
    const direction = getEmailDirection(email)
    const isOutgoing = direction === 'outgoing'

const theme = isOutgoing
    ? {
          outerBackground: '#eef5ff',
          outerBorder: '#2f80ed',
          headerBackground: '#dbeafe',
          sectionBorder: '#93c5fd',
          accent: '#2f80ed',
          titleColor: '#1e3a8a',
          labelColor: '#1d4ed8',
          directionLabel: 'Odchozí e-mail',
          directionIcon: '📤',
      }
    : {
          outerBackground: '#edf9ef',
          outerBorder: '#3b9f57',
          headerBackground: '#d9f2df',
          sectionBorder: '#8dd39f',
          accent: '#3b9f57',
          titleColor: '#234c2e',
          labelColor: '#315f3c',
          directionLabel: 'Příchozí e-mail',
          directionIcon: '📥',
      }

    const title = isRepeated
        ? `${theme.directionIcon} ${theme.directionLabel} z Outlooku · opakované vložení`
        : `${theme.directionIcon} ${theme.directionLabel} z Outlooku`

    const insertLabel = isRepeated
        ? `Vloženo znovu č. ${loggedCount + 1} · ${loggedAt}`
        : `Vloženo ${loggedAt}`

    const cc = email.emailCC
        ? `
                                                <tr>
                                                    <td style="padding: 6px 0 0 0; font-size: 13px; line-height: 1.5; color: #263238;">
                                                        <strong>Cc:</strong> ${escapeHtml(email.emailCC)}
                                                    </td>
                                                </tr>
        `
        : ''

    const warning = error
        ? `
            <tr>
                <td height="16" style="height: 16px; line-height: 16px; font-size: 1px;">&nbsp;</td>
            </tr>
            <tr>
                <td style="font-size: 13px; color: #875A7B; line-height: 1.45;">
                    <em>${escapeHtml(
                        _t(
                            'Attachments could not be logged in Odoo because their total size exceeded the allowed maximum.'
                        )
                    )}</em>
                </td>
            </tr>
        `
        : ''

    return `
        <table class="o_mail_plugin_logged_email" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
            width: 100%;
            max-width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 14px;
            border: 4px solid ${theme.outerBorder};
            background-color: ${theme.outerBackground};
            margin: 14px 0 18px 0;
            color: #263238;
        " bgcolor="${theme.outerBackground}">
            <tbody>
                <tr>
                    <td style="padding: 18px;">

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
                            width: 100%;
                            border-collapse: separate;
                            border-spacing: 0;
                            border: 2px solid ${theme.outerBorder};
                            border-radius: 10px 10px 0 0;
                            background-color: ${theme.headerBackground};
                        " bgcolor="${theme.headerBackground}">
                            <tbody>
                                <tr>
                                    <td style="
                                        padding: 14px 16px 4px 16px;
                                        color: ${theme.titleColor};
                                        font-size: 15px;
                                        line-height: 1.45;
                                        font-weight: 700;
                                    ">
                                        ${title}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="
                                        padding: 0 16px 14px 16px;
                                        color: ${theme.labelColor};
                                        font-size: 12px;
                                        line-height: 1.35;
                                        font-weight: 500;
                                    ">
                                        ${escapeHtml(insertLabel)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                                <tr>
                                    <td height="20" style="height: 20px; line-height: 20px; font-size: 1px;">&nbsp;</td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
                            width: 100%;
                            border-collapse: separate;
                            border-spacing: 0;
                            border: 2px solid ${theme.sectionBorder};
                            border-left: 8px solid ${theme.accent};
                            background-color: #ffffff;
                        " bgcolor="#ffffff">
                            <tbody>
                                <tr>
                                    <td style="
                                        padding: 16px 18px 10px 18px;
                                        font-size: 13px;
                                        line-height: 1.45;
                                        color: #294b59;
                                        font-weight: 700;
                                    ">
                                        Informace o e-mailu
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 0 18px 16px 18px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                            <tbody>
                                                <tr>
                                                    <td style="padding: 0; font-size: 13px; line-height: 1.5; color: #263238;">
                                                        <strong>Směr:</strong> ${escapeHtml(theme.directionLabel)}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 6px 0 0 0; font-size: 13px; line-height: 1.5; color: #263238;">
                                                        <strong>Od:</strong> ${escapeHtml(email.emailFrom)}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 6px 0 0 0; font-size: 13px; line-height: 1.5; color: #263238;">
                                                        <strong>Komu:</strong> ${escapeHtml(email.emailTo)}
                                                    </td>
                                                </tr>
                                                ${cc}
                                                <tr>
                                                    <td style="padding: 6px 0 0 0; font-size: 13px; line-height: 1.5; color: #263238;">
                                                        <strong>Předmět:</strong> ${escapeHtml(email.subject)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                                <tr>
                                    <td height="20" style="height: 20px; line-height: 20px; font-size: 1px;">&nbsp;</td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                                <tr>
                                    <td style="
                                        padding: 0 0 10px 2px;
                                        color: #294b59;
                                        font-size: 13px;
                                        line-height: 1.4;
                                        font-weight: 700;
                                    ">
                                        Obsah e-mailu
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
                            width: 100%;
                            border-collapse: separate;
                            border-spacing: 0;
                            border: 2px solid ${theme.sectionBorder};
                            border-left: 8px solid ${theme.accent};
                            background-color: #ffffff;
                        " bgcolor="#ffffff">
                            <tbody>
                                <tr>
                                    <td class="o_mail_plugin_logged_email_body" style="
                                        padding: 24px 26px;
                                        color: #1f2933;
                                        font-size: 13px;
                                        line-height: 1.7;
                                        word-break: break-word;
                                        overflow-wrap: anywhere;
                                    ">
                                        ${body}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tbody>
                                ${warning}
                            </tbody>
                        </table>

                    </td>
                </tr>
            </tbody>
        </table>
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
