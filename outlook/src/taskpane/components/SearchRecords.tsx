import { Button, Image, Input, makeStyles } from '@fluentui/react-components'
import { SearchRegular } from '@fluentui/react-icons'
import React from 'react'
import { OdooRecordType } from '../../../types'
import { _t } from '../../helpers/translate'
import { Email } from '../../models/email'
import { Partner } from '../../models/partner'
import RecordCard from './RecordCard'
import SearchNoRecord from './SearchNoRecord'

export interface SearchRecordsProps<T extends OdooRecordType> {
    model: string
    title?: string
    bottom?: string | React.JSX.Element
    searchPlaceholder: string
    records: T[]
    nameAttribute: keyof Omit<T, 'id'>
    descriptionAttribute: keyof Omit<T, 'id'>
    iconAttribute?: keyof Omit<T, 'id'>
    onClick: Function
    search: Function
    loading?: boolean

    // Log email
    email?: Email
    logEmail?: boolean
    logEmailTitle?: string
    logEmailAlreadyLogged?: string
    partnerIdToFollow?: number
}

const MIN_SEARCH_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 400

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '5px',
    },
    title: {
        marginBottom: '5px',
        marginTop: '5px',
    },
    input: {
        width: 'calc(100% - 40px)',
        marginBottom: '5px',
    },
    searchContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    spinner: {
        padding: '8px',
    },
    helperText: {
        marginTop: '4px',
        marginBottom: '8px',
        fontSize: '12px',
        color: '#666',
    },
})

function SearchRecords<T extends OdooRecordType>(props: SearchRecordsProps<T>) {
    const {
        descriptionAttribute,
        iconAttribute,
        model,
        nameAttribute,
        onClick,
        search,
        records: _records,
        searchPlaceholder,
        title,
        bottom,
        email,
        logEmail,
        logEmailTitle,
        logEmailAlreadyLogged,
        loading: _loading,
        partnerIdToFollow,
    } = props

    const styles = useStyles()

    const [records, setRecords] = React.useState<T[]>(_records || [])
    const [query, setQuery] = React.useState('')
    const [loading, setLoading] = React.useState(Boolean(_loading))
    const [initSearch, setInitSearch] = React.useState(true)

    const lastSearchId = React.useRef(0)

    React.useEffect(() => {
        setRecords(_records || [])
    }, [_records])

    const runSearch = async (searchQuery: string, force = false) => {
        const trimmedQuery = searchQuery.trim()

        if (!force && trimmedQuery.length < MIN_SEARCH_LENGTH) {
            setRecords(_records || [])
            setInitSearch(true)
            setLoading(false)
            return
        }

        const searchId = lastSearchId.current + 1
        lastSearchId.current = searchId

        setLoading(true)

        const result = (await search(trimmedQuery)) || []

        if (searchId !== lastSearchId.current) {
            return
        }

        setRecords(result)
        setLoading(false)
        setInitSearch(false)
    }

React.useEffect((): (() => void) | undefined => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery.length) {
        lastSearchId.current += 1
        setRecords(_records || [])
        setInitSearch(true)
        setLoading(false)
        return undefined
    }

    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
        lastSearchId.current += 1
        setRecords(_records || [])
        setInitSearch(true)
        setLoading(false)
        return undefined
    }

    const timeout = window.setTimeout(() => {
        runSearch(trimmedQuery)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
}, [query])

    const onSearch = async () => {
        await runSearch(query, true)
    }

    const onKeyUp = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            onSearch()
        }
    }

    const items = records.map((record, index) => (
        <RecordCard
            key={`${record.id || index}-${model}-${
                (record as Partner)?.email || ''
            }-${record.name}`}
            model={model}
            onClick={onClick}
            record={record}
            description={record[descriptionAttribute] as string}
            icon={iconAttribute ? (record[iconAttribute] as string) : undefined}
            name={record[nameAttribute] as string}
            email={email}
            logEmail={logEmail}
            logEmailTitle={logEmailTitle}
            logEmailAlreadyLogged={logEmailAlreadyLogged}
            partnerIdToFollow={partnerIdToFollow}
        />
    ))

    const showHelperText =
        query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH

    return (
        <div className={styles.container}>
            {title && <h4 className={styles.title}>{title}</h4>}

            <div className={styles.searchContainer}>
                <Input
                    className={styles.input}
                    value={query}
                    placeholder={searchPlaceholder}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyUp={onKeyUp}
                />

                {loading ? (
                    <Image
                        className={styles.spinner}
                        width="32px"
                        src="assets/spinner.gif"
                        alt={_t('Loading')}
                    />
                ) : (
                    <Button icon={<SearchRegular />} onClick={onSearch} />
                )}
            </div>

            {showHelperText && (
                <div className={styles.helperText}>
                    {_t('Type at least 2 characters to search.')}
                </div>
            )}

            {initSearch && bottom}

            {items.length || initSearch ? (
                <div>{items}</div>
            ) : (
                <SearchNoRecord />
            )}
        </div>
    )
}

export default SearchRecords
