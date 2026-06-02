import API from '../helpers/api'
import { postJsonRpc } from '../helpers/http'
import { Email } from './email'
import { OdooRecord } from './odoo'
import { Partner } from './partner'

/**
 * Represent a "crm.lead" record.
 */
export class Lead extends OdooRecord {
    revenuesDescription: string

    /**
     * Make a RPC call to the Odoo database to create a lead.
     *
     * Supports both payloads:
     * - newer custom payload: { id: ... }
     * - Odoo 18 payload: { lead_id: ... }
     */
    static async createLead(
        partner: Partner,
        email: Email
    ): Promise<[Lead, Partner] | null> {
        const response = await postJsonRpc(API.CREATE_LEAD, {
            email_body: await email.getBody(),
            email_subject: email.subject,
            attachments: await email.getAttachments(),
            partner_id: partner.id,
            partner_email: partner.email,
            partner_name: partner.name,
        })

        const leadId = response?.id || response?.lead_id

        if (!leadId) {
            return null
        }

        const newPartner = partner.clone()

        if (!partner.id && response.partner_id) {
            newPartner.id = response.partner_id
            newPartner.image = response.partner_image
            newPartner.isWritable = true
        }

        return [
            Lead.fromOdooResponse({
                ...response,
                id: leadId,
                lead_id: leadId,
                name: response.name || email.subject || 'New opportunity',
            }),
            newPartner,
        ]
    }

    /**
     * Parse the dictionary returned by the Odoo database endpoint.
     */
    static fromOdooResponse(values: Record<string, any>): Lead {
        const lead = new Lead()
        lead.id = values.id || values.lead_id
        lead.name = values.name
        lead.revenuesDescription =
            values.revenues_description ||
            values.revenuesDescription ||
            ''
        return lead
    }
}