import { URLS } from "../consts";
import { ErrorMessage } from "../models/error_message";
import { postJsonRpc } from "../utils/http";
import { Lead } from "./lead";
import { Task } from "./task";
import { Ticket } from "./ticket";
import { User } from "./user";

/**
 * Represent the current partner and all the information about him.
 */
export class Partner {
    id: number;
    name: string;
    email: string;

    image: string;
    isCompany: boolean;
    parentName: string;
    phone: string;
    mobile: string;

    leads: Lead[];
    leadCount: number;
    tickets: Ticket[];
    ticketCount: number;
    tasks: Task[];
    taskCount: number;

    isWritable: boolean;

    /**
     * Return the image to show in the interface for the current partner.
     */
    getImage() {
        if (!this.id || this.id < 0 || !this.image) {
            return "/assets/person.png";
        }
        return this.image;
    }

    /**
     * Clone the partner.
     */
    clone(): Partner {
        const partner = new Partner();

        partner.id = this.id;
        partner.name = this.name;
        partner.email = this.email;

        partner.image = this.image;
        partner.isCompany = this.isCompany;
        partner.parentName = this.parentName;
        partner.phone = this.phone;
        partner.mobile = this.mobile;

        partner.leads = this.leads ? [...this.leads] : [];
        partner.leadCount = this.leadCount || 0;

        partner.tickets = this.tickets ? [...this.tickets] : [];
        partner.ticketCount = this.ticketCount || 0;

        partner.tasks = this.tasks ? [...this.tasks] : [];
        partner.taskCount = this.taskCount || 0;

        partner.isWritable = this.isWritable;

        return partner;
    }

    /**
     * Unserialize the partner object (reverse JSON.stringify).
     */
    static fromJson(values: any): Partner {
        const partner = new Partner();

        partner.id = values.id;
        partner.name = values.name;
        partner.email = values.email;

        partner.image = values.image;
        partner.isCompany = values.isCompany;
        partner.parentName = values.parentName;
        partner.phone = values.phone;
        partner.mobile = values.mobile;

        partner.leadCount = values.leadCount || 0;
        partner.ticketCount = values.ticketCount || 0;
        partner.taskCount = values.taskCount || 0;

        partner.isWritable = values.isWritable;

        partner.leads = values.leads
            ? values.leads.map((leadValues: any) => Lead.fromJson(leadValues))
            : [];

        partner.tickets = values.tickets
            ? values.tickets.map((ticketValues: any) => Ticket.fromJson(ticketValues))
            : [];

        partner.tasks = values.tasks
            ? values.tasks.map((taskValues: any) => Task.fromJson(taskValues))
            : [];

        return partner;
    }

    static fromOdooResponse(values: any): Partner {
        const partner = new Partner();

        if (values.id && values.id > 0) {
            partner.id = values.id;
        }

        partner.name = values.name;
        partner.email = values.email;

        partner.image = values.image;
        partner.isCompany = values.is_company;
        partner.parentName = values.parent_name;

        partner.phone = values.phone;
        partner.mobile = values.mobile;
        partner.isWritable = values.can_write_on_partner;

        partner.leads = [];
        partner.leadCount = 0;
        partner.tickets = [];
        partner.ticketCount = 0;
        partner.tasks = [];
        partner.taskCount = 0;

        return partner;
    }

    /**
     * Create a "res.partner" with the given values in the Odoo database.
     *
     * Supports both calls:
     * - Partner.savePartner(user, partner)
     * - Partner.savePartner(partner)
     */
    static async savePartner(user: User, partner: Partner): Promise<Partner | null>;
    static async savePartner(partner: Partner): Promise<Partner | null>;
    static async savePartner(
        userOrPartner: User | Partner,
        maybePartner?: Partner,
    ): Promise<Partner | null> {
        const hasUser = !!maybePartner;
        const user = hasUser ? (userOrPartner as User) : null;
        const partner = hasUser ? maybePartner : (userOrPartner as Partner);

        if (!partner.email) {
            return null;
        }

        if (user && (!user.odooUrl || !user.odooToken)) {
            return null;
        }

        const partnerValues = {
            name: partner.name || partner.email,
            email: partner.email,
            company: -1,
        };

        const url = user
            ? user.odooUrl + URLS.PARTNER_CREATE
            : URLS.PARTNER_CREATE;

        const headers = user
            ? { Authorization: "Bearer " + user.odooToken }
            : undefined;

        const response = await postJsonRpc(url, partnerValues, headers);

        if (!response?.id) {
            return null;
        }

        const newPartner = partner.clone();

        newPartner.id = response.id;
        newPartner.image = response.image || newPartner.image;
        newPartner.isWritable = true;

        newPartner.leads = newPartner.leads || [];
        newPartner.leadCount = newPartner.leadCount || 0;

        newPartner.tickets = newPartner.tickets || [];
        newPartner.ticketCount = newPartner.ticketCount || 0;

        newPartner.tasks = newPartner.tasks || [];
        newPartner.taskCount = newPartner.taskCount || 0;

        return newPartner;
    }

    /**
     * Fetch the given partner on the Odoo database and return all information about him.
     *
     * Return
     *      - The Partner related to the given email address
     *      - True if the current user can create partner in his Odoo database
     *      - True if the current user can create projects in his Odoo database
     *      - The error message if something bad happened
     */
    static async getPartner(
        user: User,
        name: string,
        email: string,
        partnerId: number = null,
    ): Promise<[Partner, boolean, boolean, ErrorMessage]> {
        if (!user.odooUrl || !user.odooToken) {
            const error = new ErrorMessage("http_error_odoo");
            const partner = Partner.fromJson({ name, email });
            return [partner, false, false, error];
        }

        const response = await postJsonRpc(
            user.odooUrl + URLS.GET_PARTNER,
            {
                name: name,
                email: email,
                partner_id: partnerId,
            },
            { Authorization: "Bearer " + user.odooToken },
        );

        if (response && response.error) {
            const error = new ErrorMessage("odoo", response.error);
            const partner = Partner.fromJson({ name, email });
            return [partner, false, false, error];
        }

        if (!response || !response.partner) {
            const error = new ErrorMessage("http_error_odoo");
            const partner = Partner.fromJson({ name, email });
            return [partner, false, false, error];
        }

        const error = new ErrorMessage();
        const partner = Partner.fromOdooResponse({
            name,
            email,
            ...response.partner,
        });

        // Parse leads
        if (response.leads) {
            partner.leadCount = response.lead_count || 0;
            partner.leads = response.leads.map((leadValues: any) =>
                Lead.fromOdooResponse(leadValues),
            );
        }

        // Parse tickets
        if (response.tickets) {
            partner.ticketCount = response.ticket_count || 0;
            partner.tickets = response.tickets.map((ticketValues: any) =>
                Ticket.fromOdooResponse(ticketValues),
            );
        }

        // Parse tasks
        if (response.tasks) {
            partner.taskCount = response.task_count || 0;
            partner.tasks = response.tasks.map((taskValues: any) =>
                Task.fromOdooResponse(taskValues),
            );
        }

        const canCreateProject = response.can_create_project !== false;

        // undefined must be considered as true
        const canCreatePartner = response.can_create_partner !== false;

        return [partner, canCreatePartner, canCreateProject, error];
    }

    /**
     * Perform a search on the Odoo database and return the list of matched partners.
     */
    static async searchPartner(
        user: User,
        query: string | string[],
    ): Promise<[Partner[], ErrorMessage]> {
        const response = await postJsonRpc(
            user.odooUrl + URLS.SEARCH_PARTNER,
            { query },
            { Authorization: "Bearer " + user.odooToken },
        );

        if (!response?.length) {
            return [[], new ErrorMessage("http_error_odoo")];
        }

        return [
            response[0].map((values: any) => Partner.fromOdooResponse(values)),
            new ErrorMessage(),
        ];
    }
}