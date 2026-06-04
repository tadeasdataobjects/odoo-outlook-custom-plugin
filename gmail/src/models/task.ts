import API from '../helpers/api'
import { postJsonRpc } from '../helpers/http'
import { Email } from './email'
import { OdooRecord } from './odoo'
import { Partner } from './partner'

/**
 * Represent a "project.task" record.
 */
export class Task extends OdooRecord {
    projectName: string

    /**
     * Parse the dictionary returned by the Odoo endpoint.
     */
    static fromOdooResponse(values: Record<string, any>): Task {
        const task = new Task()
        task.id = values.id || values.task_id
        task.name = values.name
        task.projectName =
            values.project_name ||
            values.projectName ||
            values.project ||
            ''
        return task
    }

    /**
     * Make a RPC call to the Odoo database to create a task.
     */
    static async createTask(
        partner: Partner,
        projectId: number,
        email: Email
    ): Promise<[Task, Partner] | null> {
        const response = await postJsonRpc(API.CREATE_TASK, {
            email_body: await email.getBody(),
            email_subject: email.subject,
            attachments: await email.getAttachments(),
            partner_email: partner.email,
            partner_id: partner.id,
            partner_name: partner.name,
            project_id: projectId,
        })

        const taskId = response?.id || response?.task_id

        if (!taskId) {
            return null
        }

        const newPartner = partner.clone()

        if (!partner.id && response.partner_id) {
            newPartner.id = response.partner_id
            newPartner.image = response.partner_image
            newPartner.isWritable = true
        }

        return [
            Task.fromOdooResponse({
                ...response,
                id: taskId,
                task_id: taskId,
            }),
            newPartner,
        ]
    }
}