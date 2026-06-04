import { Button, makeStyles } from '@fluentui/react-components'
import React, { useContext } from 'react'
import { getOdooRecordURL } from '../../helpers/http'
import { _t } from '../../helpers/translate'
import { Partner } from '../../models/partner'
import RecordCard from './RecordCard'

import {
    BuildingRegular,
    MailRegular,
    PhoneRegular,
    SearchRegular,
} from '@fluentui/react-icons'
import { searchRecords } from '../../helpers/search_records'
import { Email } from '../../models/email'
import { Lead } from '../../models/lead'
import { Project } from '../../models/project'
import { Task } from '../../models/task'
import { Ticket } from '../../models/ticket'
import ErrorContext from './Error'
import { hideGlobalLoading, showGlobalLoading } from './GlobalLoading'
import LogEmail from './LogEmail'
import RecordsSection from './RecordsSection'
import SearchRecords from './SearchRecords'
import SelectProject from './SelectProject'

export interface PartnerViewProps {
    partner: Partner
    email: Email
    onSearch: Function
    pushPage: Function
    goBack: Function
    updatePartner: Function
}

const SHOW_TICKETS = false

const useStyles = makeStyles({
    title: {
        marginLeft: '5px',
        marginTop: '5px',
        marginBottom: '5px',
    },
    buttonsContainer: {
        display: 'flex',
        alignItems: 'center',
        '& > *': {
            marginLeft: '5px',
        },
        '& .fui-Button__icon, & .fui-Button__icon svg': {
            height: '22px',
            width: '22px',
        },
    },
    info: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        '& > *': {
            verticalAlign: 'middle',
        },
    },
    warningText: {
        margin: '8px 5px',
        fontSize: '12px',
        color: '#666',
    },
})

const PartnerView: React.FC<PartnerViewProps> = (props: PartnerViewProps) => {
    const { partner, email, onSearch, pushPage, goBack, updatePartner } = props
    const errorContext = useContext(ErrorContext)
    const styles = useStyles()

    const displayError = (message: string) => {
        errorContext?.showError?.(message)
    }

    // Important:
    // partner.id can sometimes be -1 / 0 / undefined for a non-existing contact.
    // In JavaScript, -1 is truthy, so we must check that the id is really > 0.
    const hasRealPartner = Number(partner.id || 0) > 0

    const onCreate = async () => {
        showGlobalLoading()
        const newPartner = await Partner.savePartner(partner)
        hideGlobalLoading()

        if (!newPartner) {
            displayError(_t('Can not save the contact'))
            return
        }

        newPartner.leads = newPartner.leads || []
        newPartner.leadCount = newPartner.leadCount || 0

        newPartner.tickets = newPartner.tickets || []
        newPartner.ticketCount = newPartner.ticketCount || 0

        newPartner.tasks = newPartner.tasks || []
        newPartner.taskCount = newPartner.taskCount || 0

        updatePartner(newPartner)
    }

    const onOpen = () => {
        if (!hasRealPartner) {
            displayError(_t('Create the contact in Odoo first.'))
            return
        }

        window.open(getOdooRecordURL('res.partner', partner.id))
    }

    const description = []

    if (partner.parentName) {
        description.push(
            <span
                className={styles.info}
                key={`companyName-${partner.parentName}`}
                title={partner.parentName}
            >
                <BuildingRegular /> {partner.parentName}
            </span>
        )
    }

    if (partner.email) {
        description.push(
            <span
                className={styles.info}
                key={`email-${partner.email}`}
                title={partner.email}
            >
                <MailRegular /> {partner.email}
            </span>
        )
    }

    if (partner.phone) {
        description.push(
            <span
                className={styles.info}
                key={`phone-${partner.phone}`}
                title={partner.phone}
            >
                <PhoneRegular /> {partner.phone}
            </span>
        )
    }

    const ensurePartnerExists = (): boolean => {
        if (hasRealPartner) {
            return true
        }

        displayError(_t('Create the contact in Odoo before logging the email.'))
        return false
    }

    const onCreateLead = async () => {
        if (!ensurePartnerExists()) {
            return
        }

        const result = await Lead.createLead(partner, email)

        if (!result) {
            displayError(_t('Could not create the opportunity'))
            return
        }

        const [record, newPartner] = result

        newPartner.leads = newPartner.leads || []
        newPartner.leadCount = newPartner.leadCount || 0

        newPartner.leads.push(record)
        newPartner.leadCount += 1

        updatePartner(newPartner)

        window.open(getOdooRecordURL('crm.lead', record.id))
    }

 const onSearchLead = async () => {
     if (!ensurePartnerExists()) {
         return
     }

     const onOpenLead = (lead: Lead) => {
         window.open(getOdooRecordURL('crm.lead', lead.id))
     }

     const searchLeads = async (query: string): Promise<Lead[]> => {
         const trimmedQuery = query.trim()

         if (!trimmedQuery) {
             return partner.leads || []
         }

         const [records, _totalCount, error] = await searchRecords(
             'crm.lead',
             trimmedQuery
         )

         if (error.code) {
             displayError(error.message)
             return []
         }

         return records.map(Lead.fromOdooResponse)
     }

     pushPage(
         <SearchRecords<Lead>
             onClick={onOpenLead}
             search={searchLeads}
             model="crm.lead"
             searchPlaceholder={_t('Search Opportunities')}
             records={partner.leads || []}
             nameAttribute="name"
             descriptionAttribute="revenuesDescription"
             email={email}
             logEmail={true}
             logEmailTitle={_t('Log the email on the opportunity')}
             logEmailAlreadyLogged={_t(
                 'Email already logged on the opportunity'
             )}
             partnerIdToFollow={partner.id}
         />
     )
 }
    const onCreateTicket = async () => {
        if (!ensurePartnerExists()) {
            return
        }

        const result = await Ticket.createTicket(partner, email)

        if (!result) {
            displayError(_t('Could not create the ticket'))
            return
        }

        const [record, newPartner] = result

        newPartner.tickets = newPartner.tickets || []
        newPartner.ticketCount = newPartner.ticketCount || 0

        newPartner.tickets.push(record)
        newPartner.ticketCount += 1

        updatePartner(newPartner)

        window.open(getOdooRecordURL('helpdesk.ticket', record.id))
    }

    const onSearchTicket = async () => {
        if (!ensurePartnerExists()) {
            return
        }

        const onOpenTicket = (ticket: Ticket) => {
            window.open(getOdooRecordURL('helpdesk.ticket', ticket.id))
        }

        const searchTickets = async (query: string): Promise<Ticket[]> => {
            const [records, _totalCount, error] = await searchRecords(
                'helpdesk.ticket',
                query
            )

            if (error.code) {
                displayError(error.message)
                return []
            }

            return records.map(Ticket.fromOdooResponse)
        }

        showGlobalLoading()
        const allTickets: Ticket[] = await searchTickets('')
        hideGlobalLoading()

        pushPage(
            <SearchRecords<Ticket>
                onClick={onOpenTicket}
                search={searchTickets}
                model="helpdesk.ticket"
                searchPlaceholder={_t('Search Tickets')}
                records={allTickets}
                nameAttribute="name"
                descriptionAttribute="stageName"
                email={email}
                logEmail={true}
                logEmailTitle={_t('Log the email on the ticket')}
                logEmailAlreadyLogged={_t('Email already logged on the ticket')}
                partnerIdToFollow={partner.id}
            />
        )
    }

    const onCreateTask = async () => {
        if (!ensurePartnerExists()) {
            return
        }

        const onSelectProject = async (
            project: Project,
            backCount: number = 1
        ) => {
            showGlobalLoading()
            const result = await Task.createTask(partner, project.id, email)
            hideGlobalLoading()

            if (!result) {
                displayError(_t('Could not create the task'))
                return
            }

            const [record, newPartner] = result

            newPartner.tasks = newPartner.tasks || []
            newPartner.taskCount = newPartner.taskCount || 0

            newPartner.tasks.push(record)
            newPartner.taskCount += 1

            goBack(backCount)
            updatePartner(newPartner)

            window.open(getOdooRecordURL('project.task', record.id))
        }

        pushPage(
            <SelectProject
                canCreateProject={partner.canCreateProject}
                onSelectProject={onSelectProject}
                pushPage={pushPage}
            />
        )
    }

const onSearchTask = async () => {
    if (!ensurePartnerExists()) {
        return
    }

    const onOpenTask = (task: Task) => {
        if (!task.id) {
            displayError(_t('Could not open the task. Missing task id.'))
            return
        }

        window.open(getOdooRecordURL('project.task', task.id))
    }

    const searchTasks = async (query: string): Promise<Task[]> => {
        const trimmedQuery = query.trim()

        if (!trimmedQuery) {
            return partner.tasks || []
        }

        const [records, _totalCount, error] = await searchRecords(
            'project.task',
            trimmedQuery
        )

        if (error.code) {
            displayError(error.message)
            return []
        }

        return records.map(Task.fromOdooResponse)
    }

    pushPage(
        <SearchRecords<Task>
            onClick={onOpenTask}
            search={searchTasks}
            model="project.task"
            searchPlaceholder={_t('Search Tasks')}
            records={partner.tasks || []}
            nameAttribute="name"
            descriptionAttribute="projectName"
            email={email}
            logEmail={true}
            logEmailTitle={_t('Log the email on the task')}
            logEmailAlreadyLogged={_t('Email already logged on the task')}
            partnerIdToFollow={partner.id}
        />
    )
}

    return (
        <div>
            <h4 className={styles.title}>{_t('Contact Details')}</h4>

            <RecordCard
                model="res.partner"
                record={partner}
                description={description}
                icon={partner.image}
                name={partner.name}
                email={email}
            />

            <div className={styles.buttonsContainer}>
                {!hasRealPartner && (
                    <Button
                        appearance="primary"
                        size="small"
                        shape="rounded"
                        onClick={onCreate}
                    >
                        {_t('Create contact in Odoo')}
                    </Button>
                )}

                {hasRealPartner && (
                    <Button
                        appearance="primary"
                        size="small"
                        shape="circular"
                        onClick={onOpen}
                    >
                        {_t('View in Odoo')}
                    </Button>
                )}

                {hasRealPartner && partner.isWritable && (
                    <LogEmail
                        recordId={partner.id}
                        model={'res.partner'}
                        email={email}
                        logEmailTitle={_t('Log email')}
                        logEmailAlreadyLogged={_t(
                            'Email already logged on the contact'
                        )}
                        partnerIdToFollow={partner.id}
                    />
                )}

                <Button
                    icon={<SearchRegular />}
                    title={_t('Search contact')}
                    size="small"
                    shape="circular"
                    appearance="subtle"
                    onClick={() => onSearch()}
                />
            </div>

            {!hasRealPartner && (
                <div className={styles.warningText}>
                    {_t(
                        'Create this contact in Odoo first, then you can log this email on an opportunity or task.'
                    )}
                </div>
            )}

            {hasRealPartner && (
                <RecordsSection
                    email={email}
                    model="crm.lead"
                    descriptionAttribute="revenuesDescription"
                    logEmailTitle={_t('Log the email on the opportunity')}
                    logEmailAlreadyLogged={_t(
                        'Email already logged on the opportunity'
                    )}
                    searchTitle={_t('Search Opportunities')}
                    sectionTitle={
                        partner.leadCount
                            ? _t('Opportunities (%s)', partner.leadCount)
                            : _t('Opportunities')
                    }
                    records={partner.leads || []}
                    recordCount={partner.leadCount || 0}
                    createRecord={onCreateLead}
                    onSearch={onSearchLead}
                    partnerIdToFollow={partner.id}
                    showRecords={false}
                />
            )}

            {hasRealPartner && SHOW_TICKETS && (
                <RecordsSection
                    email={email}
                    model="helpdesk.ticket"
                    descriptionAttribute="stageName"
                    logEmailTitle={_t('Log the email on the ticket')}
                    logEmailAlreadyLogged={_t(
                        'Email already logged on the ticket'
                    )}
                    searchTitle={_t('Search Tickets')}
                    sectionTitle={
                        partner.ticketCount
                            ? _t('Tickets (%s)', partner.ticketCount)
                            : _t('Tickets')
                    }
                    records={partner.tickets || []}
                    recordCount={partner.ticketCount || 0}
                    createRecord={onCreateTicket}
                    onSearch={onSearchTicket}
                    partnerIdToFollow={partner.id}
                    showRecords={false}
                />
            )}

            {hasRealPartner && (
                <RecordsSection
                    email={email}
                    model="project.task"
                    descriptionAttribute="projectName"
                    logEmailTitle={_t('Log the email on the task')}
                    logEmailAlreadyLogged={_t(
                        'Email already logged on the task'
                    )}
                    searchTitle={_t('Search Tasks')}
                    sectionTitle={
                        partner.taskCount
                            ? _t('Tasks (%s)', partner.taskCount)
                            : _t('Tasks')
                    }
                    records={partner.tasks || []}
                    recordCount={partner.taskCount || 0}
                    createRecord={onCreateTask}
                    onSearch={onSearchTask}
                    partnerIdToFollow={partner.id}
                    showRecords={false}
                />
            )}
        </div>
    )
}

export default PartnerView
