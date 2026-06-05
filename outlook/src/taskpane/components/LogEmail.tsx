import { Button, Image, makeStyles } from '@fluentui/react-components'
import { MailCheckmarkRegular, MailRegular } from '@fluentui/react-icons'
import React, { useContext } from 'react'
import { getLoggedState, logEmail } from '../../helpers/log_email'
import { _t } from '../../helpers/translate'
import { Email } from '../../models/email'
import ErrorContext from './Error'

export interface LogEmailProps {
    recordId: number
    model: string
    email: Email
    logEmailTitle: string
    logEmailAlreadyLogged: string
    partnerIdToFollow?: number
}

const useStyles = makeStyles({
    spinner: {
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

const LogEmail: React.FC<LogEmailProps> = (props: LogEmailProps) => {
    const {
        recordId,
        model,
        email,
        logEmailTitle,
        logEmailAlreadyLogged,
        partnerIdToFollow,
    } = props

    const errorContext = useContext(ErrorContext)
    const styles = useStyles()

    const [isEmailLogged, setIsEmailLogged] = React.useState(() =>
        getLoggedState(recordId, model, email)
    )
    const [isLogging, setIsLogging] = React.useState(false)
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

    const displayError = (message: string) => {
        errorContext?.showError?.(message)
    }

   const onLogEmail = async () => {
       if (isLogging || isEmailLogged) {
           return
       }

       setIsLogging(true)

       try {
           const error = await logEmail(
               recordId,
               model,
               email,
               partnerIdToFollow
           )

           if (error.code) {
               displayError(error.message)
               return
           }

           setIsEmailLogged(true)
           showSuccess()
       } catch (error) {
           console.error('Could not log email', error)
           displayError(_t('Could not log the email'))
       } finally {
           setIsLogging(false)
       }
   }

    if (isLogging) {
        return (
            <Image
                className={styles.spinner}
                width="24px"
                src="assets/spinner.gif"
                alt={_t('Loading')}
            />
        )
    }

    if (isEmailLogged) {
        return (
            <span className={styles.loggedContainer}>
                <Button
                    icon={<MailCheckmarkRegular />}
                    title={logEmailAlreadyLogged}
                    size="small"
                    shape="circular"
                    appearance="subtle"
                    disabled={true}
                />

                {showSuccessMessage && (
                    <span className={styles.successMessage}>
                        {_t('Email logged')}
                    </span>
                )}
            </span>
        )
    }

    return (
        <Button
            icon={<MailRegular />}
            title={logEmailTitle}
            size="small"
            shape="circular"
            appearance="subtle"
            onClick={onLogEmail}
        />
    )
}

export default LogEmail
