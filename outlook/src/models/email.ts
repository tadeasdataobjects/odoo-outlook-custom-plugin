import PostalMime from 'postal-mime'

/**
 * Remove quoted/replied/forwarded content and keep only the latest visible email.
 */
function extractLatestEmailHtml(html: string): string {
    if (!html) {
        return ''
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')

    const selectorsToRemove = [
        '#divRplyFwdMsg',
        '.gmail_quote',
        '.moz-cite-prefix',
        'blockquote',
        '[type="cite"]',
        '.yahoo_quoted',
        '.protonmail_quote',
    ]

    for (const selector of selectorsToRemove) {
        for (const element of Array.from(doc.querySelectorAll(selector))) {
            element.remove()
        }
    }

    const separatorPatterns = [
        /-----Original Message-----/i,
        /----- Forwarded message -----/i,
        /Begin forwarded message:/i,

        // English Outlook headers
        /(^|\n)\s*From:\s.+/i,
        /(^|\n)\s*Sent:\s.+/i,
        /(^|\n)\s*To:\s.+/i,
        /(^|\n)\s*Subject:\s.+/i,

        // Czech headers
        /(^|\n)\s*Od:\s.+/i,
        /(^|\n)\s*Odesláno:\s.+/i,
        /(^|\n)\s*Komu:\s.+/i,
        /(^|\n)\s*Předmět:\s.+/i,

        // Slovak headers
        /(^|\n)\s*Odoslané:\s.+/i,
        /(^|\n)\s*Predmet:\s.+/i,
    ]

    const blockElements = Array.from(
        doc.body.querySelectorAll('div, p, table, tr, td, section')
    )

    for (const element of blockElements) {
        const text = (element.textContent || '').replace(/\u00a0/g, ' ').trim()

        if (!text) {
            continue
        }

        const looksLikeReplyHeader =
            separatorPatterns.some((pattern) => pattern.test(text)) &&
            (/(^|\n)\s*(From|Od):\s/i.test(text) ||
                /(^|\n)\s*(Sent|Odesláno|Odoslané):\s/i.test(text) ||
                /-----Original Message-----/i.test(text) ||
                /Begin forwarded message:/i.test(text))

        if (looksLikeReplyHeader) {
            removeElementAndFollowingSiblings(element)
            break
        }
    }

    return doc.body.innerHTML.trim()
}

function removeElementAndFollowingSiblings(element: Element): void {
    const parent = element.parentElement

    if (!parent) {
        element.remove()
        return
    }

    let current: ChildNode | null = element

    while (current) {
        const next: ChildNode | null = current.nextSibling
        current.parentNode?.removeChild(current)
        current = next
    }
}

/**
 * Clean Outlook/Gmail generated HTML so it looks better in Odoo chatter.
 * This intentionally keeps basic formatting, links, tables, lists and inline images.
 */
function normalizeEmailBodyForOdoo(html: string): string {
    if (!html) {
        return '<p></p>'
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')

    for (const element of Array.from(
        doc.body.querySelectorAll('script, style, meta, title, link')
    )) {
        element.remove()
    }

    for (const element of Array.from(doc.body.querySelectorAll('*'))) {
        const attributes = Array.from(element.attributes)

        for (const attribute of attributes) {
            const name = attribute.name.toLowerCase()

            if (
                name === 'href' ||
                name === 'src' ||
                name === 'alt' ||
                name === 'title' ||
                name === 'colspan' ||
                name === 'rowspan'
            ) {
                continue
            }

            // Outlook produces a lot of noisy classes/styles that make chatter ugly.
            if (
                name === 'class' ||
                name === 'style' ||
                name === 'id' ||
                name === 'lang' ||
                name === 'dir' ||
                name.startsWith('data-') ||
                name.startsWith('aria-')
            ) {
                element.removeAttribute(attribute.name)
            }
        }
    }

    const cleaned = doc.body.innerHTML.trim()

    return cleaned || '<p></p>'
}

/**
 * Represent the current email open in the Outlook application.
 */
export class Email {
    subject: string
    timestamp: number
    messageId: string

    emailFrom: string
    emailTo: string
    emailCC: string
    contacts: EmailContact[]

    constructor() {
        const mailbox = Office?.context?.mailbox
        const mail = mailbox?.item

        if (!mailbox || !mail) {
            this.subject = ''
            this.timestamp = Date.now()
            this.messageId = ''

            this.emailFrom = ''
            this.emailTo = ''
            this.emailCC = ''
            this.contacts = []

            return
        }

        const userEmail = mailbox.userProfile.emailAddress

        const values = [
            [mail.from.displayName, mail.from.emailAddress],
            ...mail.to.map((v) => [v.displayName, v.emailAddress]),
            ...mail.cc.map((v) => [v.displayName, v.emailAddress]),
        ]

        this.subject = mail.subject
        this.timestamp = mail.dateTimeCreated.getTime()
        this.messageId = mail.internetMessageId

        const mailToString = (mail: Office.EmailAddressDetails): string => {
            return mail.displayName != mail.emailAddress
                ? `"${mail.displayName}" <${mail.emailAddress}>`
                : mail.emailAddress
        }

        this.emailFrom = mailToString(mail.from)
        this.emailTo = mail.to.map(mailToString).join(', ')
        this.emailCC = mail.cc.map(mailToString).join(', ')
        this.contacts = values
            .filter((v) => v[1] !== userEmail)
            .map((v) => new EmailContact(v[0], v[1]))
    }

    /**
     * Return the content of the email.
     */
    async getBody(): Promise<string> {
        let body: string = await new Promise((resolve) => {
            Office.context.mailbox.item.body.getAsync(
                Office.CoercionType.Html,
                async (result) => {
                    resolve(result.value)
                }
            )
        })

        body = extractLatestEmailHtml(body)
        body = normalizeEmailBodyForOdoo(body)

        // Add inline images.
        const emailB64: string = await new Promise((resolve) => {
            Office.context.mailbox.item.getAsFileAsync((result) => {
                resolve(result.value)
            })
        })

        const email = await PostalMime.parse(atob(emailB64))

        const toBase64 = (buffer: ArrayBuffer) => {
            let binary = ''
            const bytes = new Uint8Array(buffer)
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            return btoa(binary)
        }

        for (const attachment of email.attachments) {
            if (!attachment.contentId || attachment.disposition !== 'inline') {
                continue
            }

            const contentId = attachment.contentId
                .replace('<', '')
                .replace('>', '')

            const content = attachment.content as ArrayBuffer
            const base64Data = `data:${attachment.mimeType};base64,${toBase64(content)}`
            body = body.replace(`cid:${contentId}`, base64Data)
        }

        return body
    }

    /**
     * Return the list of attachments in the email if they do not exceed the limit.
     */
    async getAttachments(): Promise<[string, string][] | null> {
        const officeAttachmentDetails = Office.context.mailbox.item.attachments

        const totalSize = officeAttachmentDetails
            .map((officeAttachment) => officeAttachment.size)
            .reduce((partialSum, a) => partialSum + a, 0)

        const SIZE_THRESHOLD_TOTAL = 40 * 1024 * 1024

        if (totalSize > SIZE_THRESHOLD_TOTAL) {
            return null
        }

        const promises = officeAttachmentDetails
            .filter((attachment) => !attachment.isInline)
            .map((attachment) => this.fetchAttachmentContent(attachment))

        return Promise.all(promises)
    }

    /**
     * Get the content of the corresponding attachment.
     */
    fetchAttachmentContent(
        attachment: Office.AttachmentDetails
    ): Promise<[string, string]> {
        return new Promise((resolve) => {
            Office.context.mailbox.item.getAttachmentContentAsync(
                attachment.id,
                (asyncResult) =>
                    resolve([attachment.name, asyncResult.value.content])
            )
        })
    }
}

export class EmailContact {
    name: string
    email: string

    constructor(name: string, email: string) {
        this.name = name
        this.email = email
    }
}
