import { Button, Image, makeStyles } from '@fluentui/react-components'
import { MailCheckmarkRegular, MailRegular } from '@fluentui/react-icons'
import React, { useContext } from 'react'
import { getOdooRecordURL } from '../../helpers/http'
import { _t } from '../../helpers/translate'
import { Project } from '../../models/project'
import CreateProject from './CreateProject'
import ErrorContext from './Error'
import SearchRecords from './SearchRecords'

export interface SelectProjectProps {
    canCreateProject: boolean
    onSelectProject: Function
    pushPage: Function
}

interface CreateTaskInProjectButtonProps {
    project: Project
    onSelectProject: Function
}

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingTop: '5px',
    },
    title: {
        marginTop: '5px',
        marginBottom: '5px',
    },
    description: {
        marginTop: '0',
        marginBottom: '8px',
        fontSize: '12px',
        color: '#666',
    },
    button: {
        justifyContent: 'flex-start',
    },
    actionSpinner: {
        padding: '4px',
    },
    loggedContainer: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
    successMessage: {
        fontSize: '12px',
        color: '#107c10',
        whiteSpace: 'nowrap',
    },
})

const CreateTaskInProjectButton: React.FC<CreateTaskInProjectButtonProps> = (
    props: CreateTaskInProjectButtonProps
) => {
    const { project, onSelectProject } = props
    const styles = useStyles()

    const [isCreating, setIsCreating] = React.useState(false)
    const [isCreated, setIsCreated] = React.useState(false)
    const [showSuccessMessage, setShowSuccessMessage] = React.useState(false)

    const successTimeout = React.useRef<number | null>(null)

    React.useEffect(() => {
        return () => {
            if (successTimeout.current !== null) {
                window.clearTimeout(successTimeout.current)
            }
        }
    }, [])

    const showSuccess = () => {
        setShowSuccessMessage(true)

        if (successTimeout.current !== null) {
            window.clearTimeout(successTimeout.current)
        }

        successTimeout.current = window.setTimeout(() => {
            setShowSuccessMessage(false)
        }, 2500)
    }

    const onCreateTask = async () => {
        if (!project.id || isCreating || isCreated) {
            return
        }

        setIsCreating(true)

        try {
            await onSelectProject(project, 0, false)
            setIsCreated(true)
            showSuccess()
        } finally {
            setIsCreating(false)
        }
    }

    if (isCreating) {
        return (
            <Image
                className={styles.actionSpinner}
                width="24px"
                src="assets/spinner.gif"
                alt={_t('Loading')}
            />
        )
    }

    if (isCreated) {
        return (
            <span className={styles.loggedContainer}>
                <Button
                    icon={<MailCheckmarkRegular />}
                    title={_t('Task created from this email')}
                    size="small"
                    shape="circular"
                    appearance="subtle"
                    disabled={true}
                />

                {showSuccessMessage && (
                    <span className={styles.successMessage}>
                        {_t('Task created')}
                    </span>
                )}
            </span>
        )
    }

    return (
        <Button
            icon={<MailRegular />}
            title={_t('Create task from this email in this project')}
            size="small"
            shape="circular"
            appearance="subtle"
            onClick={onCreateTask}
        />
    )
}

const SelectProject: React.FC<SelectProjectProps> = (
    props: SelectProjectProps
) => {
    const { canCreateProject, onSelectProject, pushPage } = props
    const showError = useContext(ErrorContext)?.showError
    const styles = useStyles()

    const searchProject = async (query: string): Promise<Project[]> => {
        const trimmedQuery = query.trim()

        if (!trimmedQuery) {
            return []
        }

        const [result, error] = await Project.searchProject(trimmedQuery)

        if (error.code) {
            showError?.(error.message)
            return []
        }

        return result
    }

    const onOpenProject = (project: Project) => {
        if (!project.id) {
            return
        }

        window.open(getOdooRecordURL('project.project', project.id))
    }

    const renderCreateTaskAction = (project: Project) => {
        return (
            <CreateTaskInProjectButton
                project={project}
                onSelectProject={onSelectProject}
            />
        )
    }

    const onShowExistingProjectSearch = () => {
        pushPage(
            <SearchRecords<Project>
                onClick={onOpenProject}
                search={searchProject}
                model="project.project"
                searchPlaceholder={_t('Search a Project')}
                records={[]}
                nameAttribute="name"
                descriptionAttribute="description"
                title={_t('Create a Task in an existing Project')}
                bottom={
                    <span className={styles.description}>
                        {_t(
                            'Search for a project, then click the envelope to create a task from this email in that project.'
                        )}
                    </span>
                }
                recordAction={renderCreateTaskAction}
            />
        )
    }

    const onShowCreateProjectPage = () => {
        if (!canCreateProject) {
            showError?.(_t('You can not create a project.'))
            return
        }

        pushPage(
            <CreateProject
                onCreate={(project: Project) => {
                    onSelectProject(project, 2, true)
                }}
            />
        )
    }

    return (
        <div className={styles.container}>
            <h4 className={styles.title}>{_t('Create Task')}</h4>

            <p className={styles.description}>
                {_t(
                    'Choose whether you want to create the task in an existing project or create a new project first.'
                )}
            </p>

            <Button
                className={styles.button}
                appearance="primary"
                onClick={onShowExistingProjectSearch}
            >
                {_t('Create task in existing project')}
            </Button>

            {canCreateProject && (
                <Button
                    className={styles.button}
                    appearance="secondary"
                    onClick={onShowCreateProjectPage}
                >
                    {_t('Create task in new project')}
                </Button>
            )}
        </div>
    )
}

export default SelectProject
