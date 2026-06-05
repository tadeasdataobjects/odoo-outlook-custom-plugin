import { Button, makeStyles } from '@fluentui/react-components'
import React, { useContext } from 'react'
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
})

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
            showError(error.message)
            return []
        }

        return result
    }

    const onShowExistingProjectSearch = () => {
        pushPage(
            <SearchRecords<Project>
                onClick={onSelectProject}
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
                            'Search for a project, then select it to create the task there.'
                        )}
                    </span>
                }
            />
        )
    }

    const onShowCreateProjectPage = () => {
        if (!canCreateProject) {
            showError(_t('You can not create a project.'))
            return
        }

        pushPage(
            <CreateProject
                onCreate={(project: Project) => {
                    onSelectProject(project, 2)
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
