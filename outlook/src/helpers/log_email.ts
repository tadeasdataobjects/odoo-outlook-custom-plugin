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

/**
 * Format the email body before sending it to Odoo.
 */
async function _formatEmailBody(email: Email, error: boolean): Promise<string> {
    const body = await email.getBody()

    const cc = email.emailCC
        ? `<div><strong>Cc:</strong> ${escapeHtml(email.emailCC)}</div>`
        : ''

    const warning = error
        ? `<div style="margin-top: 12px; color: #875A7B;">
                <em>${escapeHtml(
                    _t(
                        'Attachments could not be logged in Odoo because their total size exceeded the allowed maximum.'
                    )
                )}</em>
           </div>`
        : ''

    return `
        <div class="o_mail_plugin_logged_email">
            <div style="font-size: 13px; color: #666; margin-bottom: 10px; line-height: 1.45;">
                <div><strong>From:</strong> ${escapeHtml(email.emailFrom)}</div>
                <div><strong>To:</strong> ${escapeHtml(email.emailTo)}</div>
                ${cc}
                <div><strong>Subject:</strong> ${escapeHtml(email.subject)}</div>
            </div>
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 8px 0 12px 0;" />
            <div class="o_mail_plugin_logged_email_body">
                ${body}
            </div>
            ${warning}
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
    const body = await _formatEmailBody(email, attachments === null)



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
 * Store in the local storage the logged state.
 */
function setLoggedState(recordId: number, recordModel: string, email: Email) {
    const baseUrl = new URL(localStorage.getItem('odoo_url')).host
    let loggedState: string[] = JSON.parse(
        localStorage.getItem('logged_state') || '[]'
    )
    const key = `${baseUrl}-${recordId}-${recordModel}-${email.messageId}`
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
 */
export function getLoggedState(
    recordId: number,
    recordModel: string,
    email: Email
): boolean {
    const baseUrl = new URL(localStorage.getItem('odoo_url')).host
    const loggedState: string[] = JSON.parse(
        localStorage.getItem('logged_state') || '[]'
    )
    const key = `${baseUrl}-${recordId}-${recordModel}-${email.messageId}`
    return loggedState.includes(key)
}
