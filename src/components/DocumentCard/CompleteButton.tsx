import {CheckmarkIcon} from '@sanity/icons'
import {
  Box,
  Button,
  Text,
  ToastContextValue,
  Tooltip,
  useToast,
} from '@sanity/ui'
import React from 'react'
import {SanityClient, useClient} from 'sanity'

import {API_VERSION} from '../../constants'

type CompleteButtonProps = {
  documentId: string
  disabled: boolean
}

async function moveDraftToPublished(
  client: SanityClient,
  publishedId: string,
  toast: ToastContextValue
) {
  const draftId = `drafts.${publishedId}`

  try {
    const draftDoc = await client.getDocument(draftId)

    if (!draftDoc) {
      toast.push({
        status: 'error',
        title: `No draft document found with _id:', ${draftId}`,
      })
      return
    }

    await client.createOrReplace({
      ...draftDoc,
      _id: publishedId,
    })

    toast.push({
      status: 'success',
      title: `Document published successfully with _id:', ${publishedId}`,
    })

    await client.delete(draftId)
    toast.push({
      status: 'success',
      title: `Draft document deleted successfully::', ${draftId}`,
    })
  } catch (error) {
    console.error('Error publishing the document:', error)
  }
}

export default function CompleteButton(props: CompleteButtonProps) {
  const {documentId, disabled = false} = props
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()

  const handleComplete: React.MouseEventHandler<HTMLButtonElement> =
    React.useCallback(
      (event) => {
        const id = event.currentTarget.value

        if (!id) {
          return
        }

        // publish the document
        moveDraftToPublished(client, id, toast)

        client
          .delete(`workflow-metadata.${id}`)
          .then(() => {
            toast.push({
              status: 'success',
              title: 'Workflow completed',
            })
          })
          .catch(() => {
            toast.push({
              status: 'error',
              title: 'Could not complete Workflow',
            })
          })
      },
      [client, toast]
    )

  return (
    <Tooltip
      portal
      content={
        <Box padding={2}>
          <Text size={1}>Remove this document from Workflow</Text>
        </Box>
      }
    >
      <Button
        value={documentId}
        onClick={handleComplete}
        text="Complete"
        icon={CheckmarkIcon}
        tone="positive"
        mode="ghost"
        fontSize={1}
        padding={2}
        tabIndex={-1}
        disabled={disabled}
      />
    </Tooltip>
  )
}
