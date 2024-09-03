import { useClient, useCurrentUser, useValidationStatus, useSchema, Preview, useFormValue, defineType, defineField, UserAvatar, useTimeAgo, TextWithTone, definePlugin, isObjectInputProps } from 'sanity';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { UsersIcon, SplitVerticalIcon, CheckmarkIcon, ArrowRightIcon, ArrowLeftIcon, EditIcon, AddIcon, PublishIcon, ErrorOutlineIcon, WarningOutlineIcon, DragHandleIcon, UserIcon, ResetIcon, InfoOutlineIcon } from '@sanity/icons';
import React, { useMemo, createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { UserSelectMenu, useListeningQuery, useProjectUsers, Feedback } from 'sanity-plugin-utils';
import { useToast, Button, Spinner, Card, Flex, Box, Text, useClickOutside, Popover, Grid, Tooltip, useTheme, Stack, MenuButton, Menu, Badge, Container } from '@sanity/ui';
import { LexoRank } from 'lexorank';
import { useRouter } from 'sanity/router';
import { Draggable, DragDropContext, Droppable } from '@hello-pangea/dnd';
import groq from 'groq';
import { useVirtualizer } from '@tanstack/react-virtual';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
function defineStates(states) {
  return states;
}
const API_VERSION = "2023-01-01";
const DEFAULT_CONFIG = {
  schemaTypes: [],
  states: defineStates([{
    id: "inReview",
    title: "In review",
    color: "primary",
    roles: ["editor", "administrator"],
    transitions: ["changesRequested", "approved"]
  }, {
    id: "changesRequested",
    title: "Changes requested",
    color: "warning",
    roles: ["editor", "administrator"],
    transitions: ["approved"]
  }, {
    id: "approved",
    title: "Approved",
    color: "success",
    roles: ["administrator"],
    transitions: ["changesRequested"],
    requireAssignment: true
  }]),
  filters: () => ""
};
function UserAssignment(props) {
  const {
    assignees,
    userList,
    documentId
  } = props;
  const client = useClient({
    apiVersion: API_VERSION
  });
  const toast = useToast();
  const addAssignee = React.useCallback(userId => {
    const user = userList.find(u => u.id === userId);
    if (!userId || !user) {
      return toast.push({
        status: "error",
        title: "Could not find User"
      });
    }
    return client.patch("workflow-metadata.".concat(documentId)).setIfMissing({
      assignees: []
    }).insert("after", "assignees[-1]", [userId]).commit().then(() => {
      return toast.push({
        title: "Added ".concat(user.displayName, " to assignees"),
        status: "success"
      });
    }).catch(err => {
      console.error(err);
      return toast.push({
        title: "Failed to add assignee",
        description: userId,
        status: "error"
      });
    });
  }, [documentId, client, toast, userList]);
  const removeAssignee = React.useCallback(userId => {
    const user = userList.find(u => u.id === userId);
    if (!userId || !user) {
      return toast.push({
        status: "error",
        title: "Could not find User"
      });
    }
    return client.patch("workflow-metadata.".concat(documentId)).unset(['assignees[@ == "'.concat(userId, '"]')]).commit().then(() => {
      return toast.push({
        title: "Removed ".concat(user.displayName, " from assignees"),
        status: "success"
      });
    }).catch(err => {
      console.error(err);
      return toast.push({
        title: "Failed to remove assignee",
        description: documentId,
        status: "error"
      });
    });
  }, [client, toast, documentId, userList]);
  const clearAssignees = React.useCallback(() => {
    return client.patch("workflow-metadata.".concat(documentId)).unset(["assignees"]).commit().then(() => {
      return toast.push({
        title: "Cleared assignees",
        status: "success"
      });
    }).catch(err => {
      console.error(err);
      return toast.push({
        title: "Failed to clear assignees",
        description: documentId,
        status: "error"
      });
    });
  }, [client, toast, documentId]);
  return /* @__PURE__ */jsx(UserSelectMenu, {
    style: {
      maxHeight: 300
    },
    value: assignees || [],
    userList,
    onAdd: addAssignee,
    onClear: clearAssignees,
    onRemove: removeAssignee
  });
}
function useWorkflowMetadata(ids) {
  const {
    data: rawData,
    loading,
    error
  } = useListeningQuery('*[_type == "workflow.metadata" && documentId in $ids]{\n      _id,\n      _type,\n      _rev,\n      assignees,\n      documentId,\n      state,\n      orderRank\n    }', {
    params: {
      ids
    },
    options: {
      apiVersion: API_VERSION
    }
  });
  const keyedMetadata = useMemo(() => {
    if (!rawData || rawData.length === 0) return {};
    return rawData.reduce((acc, cur) => {
      return {
        ...acc,
        [cur.documentId]: cur
      };
    }, {});
  }, [rawData]);
  return {
    data: keyedMetadata,
    loading,
    error
  };
}
const WorkflowContext = createContext({
  data: {},
  loading: false,
  error: false,
  ids: [],
  addId: () => null,
  removeId: () => null,
  ...DEFAULT_CONFIG
});
function useWorkflowContext(id) {
  const current = useContext(WorkflowContext);
  return {
    ...current,
    metadata: id ? current.data[id] : null
  };
}
function WorkflowProvider(props) {
  const [ids, setIds] = useState([]);
  const addId = useCallback(id => setIds(current => current.includes(id) ? current : [...current, id]), []);
  const removeId = useCallback(id => setIds(current => current.filter(i => i !== id)), []);
  const {
    data,
    loading,
    error
  } = useWorkflowMetadata(ids);
  return /* @__PURE__ */jsx(WorkflowContext.Provider, {
    value: {
      data,
      loading,
      error,
      ids,
      addId,
      removeId,
      states: props.workflow.states,
      schemaTypes: props.workflow.schemaTypes,
      filters: props.workflow.filters
    },
    children: props.renderDefault(props)
  });
}
function AssignWorkflow(props) {
  var _a;
  const {
    id
  } = props;
  const {
    metadata,
    loading,
    error
  } = useWorkflowContext(id);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const userList = useProjectUsers({
    apiVersion: API_VERSION
  });
  if (error) {
    console.error(error);
  }
  if (!metadata) {
    return null;
  }
  return {
    icon: UsersIcon,
    type: "dialog",
    disabled: !metadata || loading || error,
    label: "Assign",
    title: metadata ? null : "Document is not in Workflow",
    dialog: isDialogOpen && {
      type: "popover",
      onClose: () => {
        setDialogOpen(false);
      },
      content: /* @__PURE__ */jsx(UserAssignment, {
        userList,
        assignees: ((_a = metadata == null ? void 0 : metadata.assignees) == null ? void 0 : _a.length) > 0 ? metadata.assignees : [],
        documentId: id
      })
    },
    onHandle: () => {
      setDialogOpen(true);
    }
  };
}
function BeginWorkflow(props) {
  const {
    id,
    draft
  } = props;
  const {
    metadata,
    loading,
    error,
    states
  } = useWorkflowContext(id);
  const client = useClient({
    apiVersion: API_VERSION
  });
  const toast = useToast();
  const [beginning, setBeginning] = useState(false);
  const [complete, setComplete] = useState(false);
  if (error) {
    console.error(error);
  }
  const handle = useCallback(async () => {
    setBeginning(true);
    const lowestOrderFirstState = await client.fetch('*[_type == "workflow.metadata" && state == $state]|order(orderRank)[0].orderRank', {
      state: states[0].id
    });
    client.createIfNotExists({
      _id: "workflow-metadata.".concat(id),
      _type: "workflow.metadata",
      documentId: id,
      state: states[0].id,
      orderRank: lowestOrderFirstState ? LexoRank.parse(lowestOrderFirstState).genNext().toString() : LexoRank.min().toString(),
      locale: draft == null ? void 0 : draft.locale
    }).then(() => {
      toast.push({
        status: "success",
        title: "Workflow started",
        description: 'Document is now "'.concat(states[0].title, '"')
      });
      setBeginning(false);
      setComplete(true);
    });
  }, [id, states, client, toast]);
  if (!draft || complete || metadata) {
    return null;
  }
  return {
    icon: SplitVerticalIcon,
    type: "dialog",
    disabled: metadata || loading || error || beginning || complete,
    label: beginning ? "Beginning..." : "Begin Workflow",
    onHandle: () => {
      handle();
    }
  };
}
function CompleteWorkflow(props) {
  const {
    id
  } = props;
  const {
    metadata,
    loading,
    error,
    states
  } = useWorkflowContext(id);
  const client = useClient({
    apiVersion: API_VERSION
  });
  if (error) {
    console.error(error);
  }
  const handle = useCallback(() => {
    client.delete("workflow-metadata.".concat(id));
  }, [id, client]);
  if (!metadata) {
    return null;
  }
  const state = states.find(s => s.id === metadata.state);
  const isLastState = (state == null ? void 0 : state.id) === states[states.length - 1].id;
  return {
    icon: CheckmarkIcon,
    type: "dialog",
    disabled: loading || error || !isLastState,
    label: "Complete Workflow",
    title: isLastState ? "Removes the document from the Workflow process" : "Cannot remove from workflow until in the last state",
    onHandle: () => {
      handle();
    },
    color: "positive"
  };
}
function arraysContainMatchingString(one, two) {
  return one.some(item => two.includes(item));
}
function UpdateWorkflow(props, actionState) {
  var _a, _b, _c, _d;
  const {
    id,
    type
  } = props;
  const user = useCurrentUser();
  const client = useClient({
    apiVersion: API_VERSION
  });
  const toast = useToast();
  const currentUser = useCurrentUser();
  const {
    metadata,
    loading,
    error,
    states
  } = useWorkflowContext(id);
  const currentState = states.find(s => s.id === (metadata == null ? void 0 : metadata.state));
  const {
    assignees = []
  } = metadata != null ? metadata : {};
  const {
    validation,
    isValidating
  } = useValidationStatus(id, type);
  const hasValidationErrors = (currentState == null ? void 0 : currentState.requireValidation) && !isValidating && (validation == null ? void 0 : validation.length) > 0 && validation.find(v => v.level === "error");
  if (error) {
    console.error(error);
  }
  const onHandle = (documentId, newState) => {
    client.patch("workflow-metadata.".concat(documentId)).set({
      state: newState.id
    }).commit().then(() => {
      props.onComplete();
      toast.push({
        status: "success",
        title: 'Document state now "'.concat(newState.title, '"')
      });
    }).catch(err => {
      props.onComplete();
      console.error(err);
      toast.push({
        status: "error",
        title: "Document state update failed"
      });
    });
  };
  if (!metadata || currentState && currentState.id === actionState.id) {
    return null;
  }
  const currentStateIndex = states.findIndex(s => s.id === (currentState == null ? void 0 : currentState.id));
  const actionStateIndex = states.findIndex(s => s.id === actionState.id);
  const direction = actionStateIndex > currentStateIndex ? "promote" : "demote";
  const DirectionIcon = direction === "promote" ? ArrowRightIcon : ArrowLeftIcon;
  const directionLabel = direction === "promote" ? "Promote" : "Demote";
  const userRoleCanUpdateState = ((_a = user == null ? void 0 : user.roles) == null ? void 0 : _a.length) && ((_b = actionState == null ? void 0 : actionState.roles) == null ? void 0 : _b.length) ?
  // If the Action state is limited to specific roles
  // check that the current user has one of those roles
  arraysContainMatchingString(user.roles.map(r => r.name), actionState.roles) :
  // No roles specified on the next state, so anyone can update
  ((_c = actionState == null ? void 0 : actionState.roles) == null ? void 0 : _c.length) !== 0;
  const actionStateIsAValidTransition = (currentState == null ? void 0 : currentState.id) && ((_d = currentState == null ? void 0 : currentState.transitions) == null ? void 0 : _d.length) ?
  // If the Current State limits transitions to specific States
  // Check that the Action State is in Current State's transitions array
  currentState.transitions.includes(actionState.id) :
  // Otherwise this isn't a problem
  true;
  const userAssignmentCanUpdateState = actionState.requireAssignment ?
  // If the Action State requires assigned users
  // Check the current user ID is in the assignees array
  currentUser && (assignees == null ? void 0 : assignees.length) && assignees.includes(currentUser.id) :
  // Otherwise this isn't a problem
  true;
  let title = "".concat(directionLabel, ' State to "').concat(actionState.title, '"');
  if (!userRoleCanUpdateState) {
    title = "Your User role cannot ".concat(directionLabel, ' State to "').concat(actionState.title, '"');
  } else if (!actionStateIsAValidTransition) {
    title = "You cannot ".concat(directionLabel, ' State to "').concat(actionState.title, '" from "').concat(currentState == null ? void 0 : currentState.title, '"');
  } else if (!userAssignmentCanUpdateState) {
    title = "You must be assigned to the document to ".concat(directionLabel, ' State to "').concat(actionState.title, '"');
  } else if ((currentState == null ? void 0 : currentState.requireValidation) && isValidating) {
    title = "Document is validating, cannot ".concat(directionLabel, ' State to "').concat(actionState.title, '"');
  } else if (hasValidationErrors) {
    title = "Document has validation errors, cannot ".concat(directionLabel, ' State to "').concat(actionState.title, '"');
  }
  return {
    icon: DirectionIcon,
    disabled: loading || error || (currentState == null ? void 0 : currentState.requireValidation) && isValidating || hasValidationErrors || !currentState || !userRoleCanUpdateState || !actionStateIsAValidTransition || !userAssignmentCanUpdateState,
    title,
    label: actionState.title,
    onHandle: () => onHandle(id, actionState)
  };
}
function AssigneesBadge(documentId, currentUser) {
  var _a;
  const {
    metadata,
    loading,
    error
  } = useWorkflowContext(documentId);
  const userList = useProjectUsers({
    apiVersion: API_VERSION
  });
  if (loading || error || !metadata) {
    if (error) {
      console.error(error);
    }
    return null;
  }
  if (!((_a = metadata == null ? void 0 : metadata.assignees) == null ? void 0 : _a.length)) {
    return {
      label: "Unassigned"
    };
  }
  const {
    assignees
  } = metadata != null ? metadata : [];
  const hasMe = currentUser ? assignees.some(assignee => assignee === currentUser.id) : false;
  const assigneesCount = hasMe ? assignees.length - 1 : assignees.length;
  const assigneeUsers = userList.filter(user => assignees.includes(user.id));
  const title = assigneeUsers.map(user => user.displayName).join(", ");
  let label;
  if (hasMe && assigneesCount === 0) {
    label = "Assigned to Me";
  } else if (hasMe && assigneesCount > 0) {
    label = "Me and ".concat(assigneesCount, " ").concat(assigneesCount === 1 ? "other" : "others");
  } else {
    label = "".concat(assigneesCount, " assigned");
  }
  return {
    label,
    title,
    color: "primary"
  };
}
function StateBadge(documentId) {
  const {
    metadata,
    loading,
    error,
    states
  } = useWorkflowContext(documentId);
  const state = states.find(s => s.id === (metadata == null ? void 0 : metadata.state));
  if (loading || error) {
    if (error) {
      console.error(error);
    }
    return null;
  }
  if (!state) {
    return null;
  }
  return {
    label: state.title,
    // title: state.title,
    color: state == null ? void 0 : state.color
  };
}
function WorkflowSignal(props) {
  var _a;
  const documentId = ((_a = props == null ? void 0 : props.value) == null ? void 0 : _a._id) ? props.value._id.replace("drafts.", "") : null;
  const {
    addId,
    removeId
  } = useWorkflowContext();
  useEffect(() => {
    if (documentId) {
      addId(documentId);
    }
    return () => {
      if (documentId) {
        removeId(documentId);
      }
    };
  }, [documentId, addId, removeId]);
  return props.renderDefault(props);
}
function EditButton(props) {
  const {
    id,
    type,
    disabled = false
  } = props;
  const {
    navigateIntent
  } = useRouter();
  return /* @__PURE__ */jsx(Button, {
    onClick: () => navigateIntent("edit", {
      id,
      type
    }),
    mode: "ghost",
    fontSize: 1,
    padding: 2,
    tabIndex: -1,
    icon: EditIcon,
    text: "Edit",
    disabled
  });
}
function Field(props) {
  var _a;
  const schema = useSchema();
  const {
    data,
    loading,
    error
  } = useListeningQuery("*[_id in [$id, $draftId]]|order(_updatedAt)[0]", {
    params: {
      id: String(props.value),
      draftId: "drafts.".concat(String(props.value))
    }
  });
  if (loading) {
    return /* @__PURE__ */jsx(Spinner, {});
  }
  const schemaType = schema.get((_a = data == null ? void 0 : data._type) != null ? _a : "");
  if (error || !(data == null ? void 0 : data._type) || !schemaType) {
    return /* @__PURE__ */jsx(Feedback, {
      tone: "critical",
      title: "Error with query"
    });
  }
  return /* @__PURE__ */jsx(Card, {
    border: true,
    padding: 2,
    children: /* @__PURE__ */jsxs(Flex, {
      align: "center",
      justify: "space-between",
      gap: 2,
      children: [/* @__PURE__ */jsx(Preview, {
        layout: "default",
        value: data,
        schemaType
      }), /* @__PURE__ */jsx(EditButton, {
        id: data._id,
        type: data._type
      })]
    })
  });
}
const UserAssignmentInput = props => {
  var _a;
  const documentId = useFormValue(["documentId"]);
  const userList = useProjectUsers({
    apiVersion: API_VERSION
  });
  const stringValue = Array.isArray(props == null ? void 0 : props.value) && ((_a = props == null ? void 0 : props.value) == null ? void 0 : _a.length) ? props.value.map(item => String(item)) : [];
  return /* @__PURE__ */jsx(Card, {
    border: true,
    padding: 1,
    children: /* @__PURE__ */jsx(UserAssignment, {
      userList,
      assignees: stringValue,
      documentId: String(documentId)
    })
  });
};
function initialRank() {
  let lastRankValue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
  const lastRank = lastRankValue && typeof lastRankValue === "string" ? LexoRank.parse(lastRankValue) : LexoRank.min();
  const nextRank = lastRank.genNext().genNext();
  return nextRank.value;
}
var metadata = states => defineType({
  type: "document",
  name: "workflow.metadata",
  title: "Workflow metadata",
  liveEdit: true,
  fields: [defineField({
    name: "state",
    description: 'The current "State" of the document. Field is read only as changing it would not fire the state\'s "operation" setting. These are fired in the Document Actions and in the custom Tool.',
    readOnly: true,
    type: "string",
    options: {
      list: states.length ? states.map(state => ({
        value: state.id,
        title: state.title
      })) : [],
      layout: "radio"
    }
  }), defineField({
    name: "documentId",
    title: "Document ID",
    description: "Used to help identify the target document that this metadata is tracking state for.",
    type: "string",
    readOnly: true,
    components: {
      input: Field
    }
  }), defineField({
    name: "orderRank",
    description: "Used to maintain order position of cards in the Tool.",
    type: "string",
    readOnly: true,
    initialValue: async (p, _ref) => {
      let {
        getClient
      } = _ref;
      const lastDocOrderRank = await getClient({
        apiVersion: API_VERSION
      }).fetch("*[_type == $type]|order(@[$order] desc)[0][$order]", {
        order: "orderRank",
        type: "workflow.metadata"
      });
      return initialRank(lastDocOrderRank);
    }
  }), defineField({
    type: "array",
    name: "assignees",
    of: [{
      type: "string"
    }],
    components: {
      input: UserAssignmentInput
    }
  })]
});
function filterItemsAndSort(items, stateId) {
  let selectedUsers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  let selectedSchemaTypes = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  return items.filter(item => item == null ? void 0 : item._id).filter(item => {
    var _a;
    return ((_a = item == null ? void 0 : item._metadata) == null ? void 0 : _a.state) === stateId;
  }).filter(item => {
    var _a, _b, _c;
    return selectedUsers.length && ((_b = (_a = item._metadata) == null ? void 0 : _a.assignees) == null ? void 0 : _b.length) ? (_c = item._metadata) == null ? void 0 : _c.assignees.some(assignee => selectedUsers.includes(assignee)) : !selectedUsers.length;
  }).filter(item => {
    if (!selectedSchemaTypes) {
      return true;
    }
    return selectedSchemaTypes.length ? selectedSchemaTypes.includes(item._type) : false;
  }).sort((a, b) => {
    var _a, _b;
    const aOrderRank = ((_a = a._metadata) == null ? void 0 : _a.orderRank) || "0";
    const bOrderRank = ((_b = b._metadata) == null ? void 0 : _b.orderRank) || "0";
    return aOrderRank.localeCompare(bOrderRank);
  });
}
var __freeze$2 = Object.freeze;
var __defProp$2 = Object.defineProperty;
var __template$2 = (cooked, raw) => __freeze$2(__defProp$2(cooked, "raw", {
  value: __freeze$2(raw || cooked.slice())
}));
var _a$2;
function useWorkflowDocuments(schemaTypes, filtered) {
  const toast = useToast();
  const client = useClient({
    apiVersion: API_VERSION
  });
  const localeFilter = filtered != null ? filtered : "";
  const QUERY = groq(_a$2 || (_a$2 = __template$2(['*[_type == "workflow.metadata" ', ']|order(orderRank){\n    "_metadata": {\n      _rev,\n      assignees,\n      documentId,\n      state,\n      orderRank,\n      "draftDocumentId": "drafts." + documentId,\n    }\n  }{\n    ...,\n    ...(\n      *[_id == ^._metadata.documentId || _id == ^._metadata.draftDocumentId]|order(_updatedAt)[0]{ \n        _id, \n        _type, \n        _rev, \n        _updatedAt \n      }\n    )\n  }'])), localeFilter);
  const {
    data,
    loading,
    error
  } = useListeningQuery(QUERY, {
    params: {
      schemaTypes
    },
    initialValue: []
  });
  const [localDocuments, setLocalDocuments] = React.useState([]);
  React.useEffect(() => {
    if (data) {
      setLocalDocuments(data);
    }
  }, [data]);
  const move = React.useCallback(async (draggedId, destination, states, newOrder) => {
    const currentLocalData = localDocuments;
    const newLocalDocuments = localDocuments.map(item => {
      var _a2;
      if (((_a2 = item == null ? void 0 : item._metadata) == null ? void 0 : _a2.documentId) === draggedId) {
        return {
          ...item,
          _metadata: {
            ...item._metadata,
            state: destination.droppableId,
            orderRank: newOrder,
            // This value won't be written to the document
            // It's done so that un/publish operations don't happen twice
            // Because a moved document's card will update once optimistically
            // and then again when the document is updated
            optimistic: true
          }
        };
      }
      return item;
    });
    setLocalDocuments(newLocalDocuments);
    const newStateId = destination.droppableId;
    const newState = states.find(s => s.id === newStateId);
    const document = localDocuments.find(d => {
      var _a2;
      return ((_a2 = d == null ? void 0 : d._metadata) == null ? void 0 : _a2.documentId) === draggedId;
    });
    if (!(newState == null ? void 0 : newState.id)) {
      toast.push({
        title: "Could not find target state ".concat(newStateId),
        status: "error"
      });
      return null;
    }
    if (!document) {
      toast.push({
        title: "Could not find dragged document in data",
        status: "error"
      });
      return null;
    }
    const {
      _id,
      _type
    } = document;
    const {
      documentId,
      _rev
    } = document._metadata || {};
    await client.patch("workflow-metadata.".concat(documentId)).ifRevisionId(_rev).set({
      state: newStateId,
      orderRank: newOrder
    }).commit().then(res => {
      var _a2, _b;
      toast.push({
        title: newState.id === document._metadata.state ? 'Reordered in "'.concat((_a2 = newState == null ? void 0 : newState.title) != null ? _a2 : newStateId, '"') : 'Moved to "'.concat((_b = newState == null ? void 0 : newState.title) != null ? _b : newStateId, '"'),
        status: "success"
      });
      return res;
    }).catch(err => {
      var _a2;
      setLocalDocuments(currentLocalData);
      toast.push({
        title: 'Failed to move to "'.concat((_a2 = newState == null ? void 0 : newState.title) != null ? _a2 : newStateId, '"'),
        description: err.message,
        status: "error"
      });
      return null;
    });
    return {
      _id,
      _type,
      documentId,
      state: newState
    };
  }, [client, toast, localDocuments]);
  return {
    workflowData: {
      data: localDocuments,
      loading,
      error
    },
    operations: {
      move
    }
  };
}
function AvatarGroup(props) {
  const currentUser = useCurrentUser();
  const {
    users,
    max = 4
  } = props;
  const len = users == null ? void 0 : users.length;
  const {
    me,
    visibleUsers
  } = React.useMemo(() => {
    return {
      me: (currentUser == null ? void 0 : currentUser.id) ? users.find(u => u.id === currentUser.id) : void 0,
      visibleUsers: users.filter(u => u.id !== (currentUser == null ? void 0 : currentUser.id)).slice(0, max - 1)
    };
  }, [users, max, currentUser]);
  if (!(users == null ? void 0 : users.length)) {
    return null;
  }
  return /* @__PURE__ */jsxs(Flex, {
    align: "center",
    gap: 1,
    children: [me ? /* @__PURE__ */jsx(UserAvatar, {
      user: me
    }) : null, visibleUsers.map(user => /* @__PURE__ */jsx(Box, {
      style: {
        marginRight: -8
      },
      children: /* @__PURE__ */jsx(UserAvatar, {
        user
      })
    }, user.id)), len > max && /* @__PURE__ */jsx(Box, {
      paddingLeft: 2,
      children: /* @__PURE__ */jsxs(Text, {
        size: 1,
        children: ["+", len - max]
      })
    })]
  });
}
function UserDisplay(props) {
  const {
    assignees,
    userList,
    documentId,
    disabled = false
  } = props;
  const [button] = React.useState(null);
  const [popover, setPopover] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const close = React.useCallback(() => setIsOpen(false), []);
  const open = React.useCallback(() => setIsOpen(true), []);
  useClickOutside(close, [button, popover]);
  return /* @__PURE__ */jsx(Popover, {
    ref: setPopover,
    content: /* @__PURE__ */jsx(UserAssignment, {
      userList,
      assignees,
      documentId
    }),
    portal: true,
    open: isOpen,
    children: !assignees || assignees.length === 0 ? /* @__PURE__ */jsx(Button, {
      onClick: open,
      fontSize: 1,
      padding: 2,
      tabIndex: -1,
      icon: AddIcon,
      text: "Assign",
      tone: "positive",
      mode: "ghost",
      disabled
    }) : /* @__PURE__ */jsx(Grid, {
      children: /* @__PURE__ */jsx(Button, {
        onClick: open,
        padding: 0,
        mode: "bleed",
        disabled,
        children: /* @__PURE__ */jsx(AvatarGroup, {
          users: userList.filter(u => assignees.includes(u.id))
        })
      })
    })
  });
}
function CompleteButton(props) {
  const {
    documentId,
    disabled = false
  } = props;
  const client = useClient({
    apiVersion: API_VERSION
  });
  const toast = useToast();
  const handleComplete = React.useCallback(event => {
    const id = event.currentTarget.value;
    if (!id) {
      return;
    }
    client.delete("workflow-metadata.".concat(id)).then(() => {
      toast.push({
        status: "success",
        title: "Workflow completed"
      });
    }).catch(() => {
      toast.push({
        status: "error",
        title: "Could not complete Workflow"
      });
    });
  }, [client, toast]);
  return /* @__PURE__ */jsx(Tooltip, {
    portal: true,
    content: /* @__PURE__ */jsx(Box, {
      padding: 2,
      children: /* @__PURE__ */jsx(Text, {
        size: 1,
        children: "Remove this document from Workflow"
      })
    }),
    children: /* @__PURE__ */jsx(Button, {
      value: documentId,
      onClick: handleComplete,
      text: "Complete",
      icon: CheckmarkIcon,
      tone: "positive",
      mode: "ghost",
      fontSize: 1,
      padding: 2,
      tabIndex: -1,
      disabled
    })
  });
}
function TimeAgo(_ref2) {
  let {
    time
  } = _ref2;
  const timeAgo = useTimeAgo(time);
  return /* @__PURE__ */jsxs("span", {
    title: timeAgo,
    children: [timeAgo, " ago"]
  });
}
function DraftStatus(props) {
  const {
    document
  } = props;
  const updatedAt = document && "_updatedAt" in document && document._updatedAt;
  return /* @__PURE__ */jsx(Tooltip, {
    portal: true,
    content: /* @__PURE__ */jsx(Box, {
      padding: 2,
      children: /* @__PURE__ */jsx(Text, {
        size: 1,
        children: document ? /* @__PURE__ */jsxs(Fragment, {
          children: ["Edited ", updatedAt && /* @__PURE__ */jsx(TimeAgo, {
            time: updatedAt
          })]
        }) : /* @__PURE__ */jsx(Fragment, {
          children: "No unpublished edits"
        })
      })
    }),
    children: /* @__PURE__ */jsx(TextWithTone, {
      tone: "caution",
      dimmed: !document,
      muted: !document,
      size: 1,
      children: /* @__PURE__ */jsx(EditIcon, {})
    })
  });
}
function PublishedStatus(props) {
  const {
    document
  } = props;
  const updatedAt = document && "_updatedAt" in document && document._updatedAt;
  return /* @__PURE__ */jsx(Tooltip, {
    portal: true,
    content: /* @__PURE__ */jsx(Box, {
      padding: 2,
      children: /* @__PURE__ */jsx(Text, {
        size: 1,
        children: document ? /* @__PURE__ */jsxs(Fragment, {
          children: ["Published ", updatedAt && /* @__PURE__ */jsx(TimeAgo, {
            time: updatedAt
          })]
        }) : /* @__PURE__ */jsx(Fragment, {
          children: "Not published"
        })
      })
    }),
    children: /* @__PURE__ */jsx(TextWithTone, {
      tone: "positive",
      dimmed: !document,
      muted: !document,
      size: 1,
      children: /* @__PURE__ */jsx(PublishIcon, {})
    })
  });
}
function Validate(props) {
  const {
    documentId,
    type,
    onChange
  } = props;
  const {
    isValidating,
    validation = []
  } = useValidationStatus(documentId, type);
  useEffect(() => {
    onChange({
      isValidating,
      validation
    });
  }, [onChange, isValidating, validation]);
  return null;
}
function ValidationStatus(props) {
  const {
    validation = []
  } = props;
  if (!validation.length) {
    return null;
  }
  const hasError = validation.some(item => item.level === "error");
  return /* @__PURE__ */jsx(Tooltip, {
    portal: true,
    content: /* @__PURE__ */jsx(Box, {
      padding: 2,
      children: /* @__PURE__ */jsx(Text, {
        size: 1,
        children: validation.length === 1 ? "1 validation issue" : "".concat(validation.length, " validation issues")
      })
    }),
    children: /* @__PURE__ */jsx(TextWithTone, {
      tone: hasError ? "critical" : "caution",
      size: 1,
      children: hasError ? /* @__PURE__ */jsx(ErrorOutlineIcon, {}) : /* @__PURE__ */jsx(WarningOutlineIcon, {})
    })
  });
}
function DocumentCard(props) {
  var _a, _b;
  const {
    isDragDisabled,
    isPatching,
    userRoleCanDrop,
    isDragging,
    item,
    states,
    toggleInvalidDocumentId,
    userList
  } = props;
  const {
    assignees = [],
    documentId
  } = (_a = item._metadata) != null ? _a : {};
  const schema = useSchema();
  const state = states.find(s => {
    var _a2;
    return s.id === ((_a2 = item._metadata) == null ? void 0 : _a2.state);
  });
  const isDarkMode = useTheme().sanity.color.dark;
  const defaultCardTone = isDarkMode ? "transparent" : "default";
  const [optimisticValidation, setOptimisticValidation] = useState({
    isValidating: (_b = state == null ? void 0 : state.requireValidation) != null ? _b : false,
    validation: []
  });
  const {
    isValidating,
    validation
  } = optimisticValidation;
  const handleValidation = useCallback(updates => {
    setOptimisticValidation(updates);
  }, []);
  const cardTone = useMemo(() => {
    let tone = defaultCardTone;
    if (!userRoleCanDrop) return isDarkMode ? "default" : "transparent";
    if (!documentId) return tone;
    if (isPatching) tone = isDarkMode ? "default" : "transparent";
    if (isDragging) tone = "positive";
    if ((state == null ? void 0 : state.requireValidation) && !isValidating && validation.length > 0) {
      if (validation.some(v => v.level === "error")) {
        tone = "critical";
      } else {
        tone = "caution";
      }
    }
    return tone;
  }, [defaultCardTone, userRoleCanDrop, isPatching, isDarkMode, documentId, isDragging, isValidating, validation, state == null ? void 0 : state.requireValidation]);
  useEffect(() => {
    if (!isValidating && validation.length > 0) {
      if (validation.some(v => v.level === "error")) {
        toggleInvalidDocumentId(documentId, "ADD");
      } else {
        toggleInvalidDocumentId(documentId, "REMOVE");
      }
    } else {
      toggleInvalidDocumentId(documentId, "REMOVE");
    }
  }, [documentId, isValidating, toggleInvalidDocumentId, validation]);
  const hasError = useMemo(() => isValidating ? false : validation.some(v => v.level === "error"), [isValidating, validation]);
  const isLastState = useMemo(() => {
    var _a2;
    return states[states.length - 1].id === ((_a2 = item._metadata) == null ? void 0 : _a2.state);
  }, [states, item._metadata.state]);
  return /* @__PURE__ */jsxs(Fragment, {
    children: [(state == null ? void 0 : state.requireValidation) ? /* @__PURE__ */jsx(Validate, {
      documentId,
      type: item._type,
      onChange: handleValidation
    }) : null, /* @__PURE__ */jsx(Box, {
      paddingBottom: 3,
      paddingX: 3,
      children: /* @__PURE__ */jsx(Card, {
        radius: 2,
        shadow: isDragging ? 3 : 1,
        tone: cardTone,
        children: /* @__PURE__ */jsxs(Stack, {
          children: [/* @__PURE__ */jsx(Card, {
            borderBottom: true,
            radius: 2,
            paddingRight: 2,
            tone: cardTone,
            style: {
              pointerEvents: "none"
            },
            children: /* @__PURE__ */jsxs(Flex, {
              align: "center",
              justify: "space-between",
              gap: 1,
              children: [/* @__PURE__ */jsx(Box, {
                flex: 1,
                children: /* @__PURE__ */jsx(Preview, {
                  layout: "default",
                  skipVisibilityCheck: true,
                  value: item,
                  schemaType: schema.get(item._type)
                })
              }), /* @__PURE__ */jsx(Box, {
                style: {
                  flexShrink: 0
                },
                children: hasError || isDragDisabled || isPatching ? null : /* @__PURE__ */jsx(DragHandleIcon, {})
              })]
            })
          }), /* @__PURE__ */jsxs(Card, {
            padding: 2,
            radius: 2,
            tone: "inherit",
            children: [/* @__PURE__ */jsxs(Flex, {
              align: "center",
              justify: "space-between",
              gap: 3,
              children: [/* @__PURE__ */jsx(Box, {
                flex: 1,
                children: documentId && /* @__PURE__ */jsx(UserDisplay, {
                  userList,
                  assignees,
                  documentId,
                  disabled: !userRoleCanDrop
                })
              }), validation.length > 0 ? /* @__PURE__ */jsx(ValidationStatus, {
                validation
              }) : null, /* @__PURE__ */jsx(DraftStatus, {
                document: item
              }), /* @__PURE__ */jsx(PublishedStatus, {
                document: item
              }), /* @__PURE__ */jsx(EditButton, {
                id: item._id,
                type: item._type,
                disabled: !userRoleCanDrop
              }), isLastState && states.length <= 3 ? /* @__PURE__ */jsx(CompleteButton, {
                documentId,
                disabled: !userRoleCanDrop
              }) : null]
            }), isLastState && states.length > 3 ? /* @__PURE__ */jsx(Stack, {
              paddingTop: 2,
              children: /* @__PURE__ */jsx(CompleteButton, {
                documentId,
                disabled: !userRoleCanDrop
              })
            }) : null]
          })]
        })
      })
    })]
  });
}
function getStyle(draggableStyle, virtualItem) {
  let transform = "translateY(".concat(virtualItem.start, "px)");
  if (draggableStyle && draggableStyle.transform) {
    const draggableTransformY = parseInt(draggableStyle.transform.split(",")[1].split("px")[0], 10);
    transform = "translateY(".concat(virtualItem.start + draggableTransformY, "px)");
  }
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "".concat(virtualItem.size, "px"),
    transform
  };
}
function DocumentList(props) {
  const {
    data = [],
    invalidDocumentIds,
    patchingIds,
    selectedSchemaTypes,
    selectedUserIds,
    state,
    states,
    toggleInvalidDocumentId,
    user,
    userList,
    userRoleCanDrop
  } = props;
  const dataFiltered = useMemo(() => {
    return data.length ? filterItemsAndSort(data, state.id, selectedUserIds, selectedSchemaTypes) : [];
  }, [data, selectedSchemaTypes, selectedUserIds, state.id]);
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: dataFiltered.length,
    getScrollElement: () => parentRef.current,
    getItemKey: index => {
      var _a, _b, _c;
      return (_c = (_b = (_a = dataFiltered[index]) == null ? void 0 : _a._metadata) == null ? void 0 : _b.documentId) != null ? _c : index;
    },
    estimateSize: () => 115,
    overscan: 7,
    measureElement: element => {
      return element.getBoundingClientRect().height || 115;
    }
  });
  if (!data.length || !dataFiltered.length) {
    return null;
  }
  return /* @__PURE__ */jsx("div", {
    ref: parentRef,
    style: {
      height: "100%",
      overflow: "auto",
      // Smooths scrollbar behaviour
      overflowAnchor: "none",
      scrollBehavior: "auto",
      paddingTop: 1
    },
    children: /* @__PURE__ */jsx("div", {
      style: {
        height: "".concat(virtualizer.getTotalSize(), "px"),
        width: "100%",
        position: "relative"
      },
      children: virtualizer.getVirtualItems().map(virtualItem => {
        var _a;
        const item = dataFiltered[virtualItem.index];
        const {
          documentId,
          assignees
        } = (_a = item == null ? void 0 : item._metadata) != null ? _a : {};
        const isInvalid = invalidDocumentIds.includes(documentId);
        const meInAssignees = (user == null ? void 0 : user.id) ? assignees == null ? void 0 : assignees.includes(user.id) : false;
        const isDragDisabled = patchingIds.includes(documentId) || !userRoleCanDrop || isInvalid || !(state.requireAssignment ? state.requireAssignment && meInAssignees : true);
        return /* @__PURE__ */jsx(Draggable, {
          draggableId: documentId,
          index: virtualItem.index,
          isDragDisabled,
          children: (draggableProvided, draggableSnapshot) => /* @__PURE__ */jsx("div", {
            ref: draggableProvided.innerRef,
            ...draggableProvided.draggableProps,
            ...draggableProvided.dragHandleProps,
            style: getStyle(draggableProvided.draggableProps.style, virtualItem),
            children: /* @__PURE__ */jsx("div", {
              ref: virtualizer.measureElement,
              "data-index": virtualItem.index,
              children: /* @__PURE__ */jsx(DocumentCard, {
                userRoleCanDrop,
                isDragDisabled,
                isPatching: patchingIds.includes(documentId),
                isDragging: draggableSnapshot.isDragging,
                item,
                toggleInvalidDocumentId,
                userList,
                states
              })
            })
          })
        }, virtualItem.key);
      })
    })
  });
}
function Filters(props) {
  const {
    uniqueAssignedUsers = [],
    selectedUserIds,
    schemaTypes,
    selectedSchemaTypes,
    toggleSelectedUser,
    resetSelectedUsers,
    toggleSelectedSchemaType
  } = props;
  const currentUser = useCurrentUser();
  const schema = useSchema();
  const onAdd = useCallback(id => {
    if (!selectedUserIds.includes(id)) {
      toggleSelectedUser(id);
    }
  }, [selectedUserIds, toggleSelectedUser]);
  const onRemove = useCallback(id => {
    if (selectedUserIds.includes(id)) {
      toggleSelectedUser(id);
    }
  }, [selectedUserIds, toggleSelectedUser]);
  const onClear = useCallback(() => {
    resetSelectedUsers();
  }, [resetSelectedUsers]);
  if (uniqueAssignedUsers.length === 0 && schemaTypes.length < 2) {
    return null;
  }
  const meInUniqueAssignees = (currentUser == null ? void 0 : currentUser.id) && uniqueAssignedUsers.find(u => u.id === currentUser.id);
  const uniqueAssigneesNotMe = uniqueAssignedUsers.filter(u => u.id !== (currentUser == null ? void 0 : currentUser.id));
  return /* @__PURE__ */jsx(Card, {
    tone: "primary",
    padding: 2,
    borderBottom: true,
    style: {
      overflowX: "hidden"
    },
    children: /* @__PURE__ */jsxs(Flex, {
      align: "center",
      children: [/* @__PURE__ */jsx(Flex, {
        align: "center",
        gap: 1,
        flex: 1,
        children: uniqueAssignedUsers.length > 5 ? /* @__PURE__ */jsx(Card, {
          tone: "default",
          children: /* @__PURE__ */jsx(MenuButton, {
            button: /* @__PURE__ */jsx(Button, {
              padding: 3,
              fontSize: 1,
              text: "Filter Assignees",
              tone: "primary",
              icon: UserIcon
            }),
            id: "user-filters",
            menu: /* @__PURE__ */jsx(Menu, {
              children: /* @__PURE__ */jsx(UserSelectMenu, {
                value: selectedUserIds,
                userList: uniqueAssignedUsers,
                onAdd,
                onRemove,
                onClear,
                labels: {
                  addMe: "Filter mine",
                  removeMe: "Clear mine",
                  clear: "Clear filters"
                }
              })
            }),
            popover: {
              portal: true
            }
          })
        }) : /* @__PURE__ */jsxs(Fragment, {
          children: [meInUniqueAssignees ? /* @__PURE__ */jsxs(Fragment, {
            children: [/* @__PURE__ */jsx(Button, {
              padding: 0,
              mode: selectedUserIds.includes(currentUser.id) ? "default" : "bleed",
              onClick: () => toggleSelectedUser(currentUser.id),
              children: /* @__PURE__ */jsx(Flex, {
                padding: 1,
                align: "center",
                justify: "center",
                children: /* @__PURE__ */jsx(UserAvatar, {
                  user: currentUser.id,
                  size: 1,
                  withTooltip: true
                })
              })
            }), /* @__PURE__ */jsx(Card, {
              borderRight: true,
              style: {
                height: 30
              },
              tone: "inherit"
            })]
          }) : null, uniqueAssigneesNotMe.map(user => /* @__PURE__ */jsx(Button, {
            padding: 0,
            mode: selectedUserIds.includes(user.id) ? "default" : "bleed",
            onClick: () => toggleSelectedUser(user.id),
            children: /* @__PURE__ */jsx(Flex, {
              padding: 1,
              align: "center",
              justify: "center",
              children: /* @__PURE__ */jsx(UserAvatar, {
                user,
                size: 1,
                withTooltip: true
              })
            })
          }, user.id)), selectedUserIds.length > 0 ? /* @__PURE__ */jsx(Button, {
            padding: 3,
            fontSize: 1,
            text: "Clear",
            onClick: resetSelectedUsers,
            mode: "ghost",
            icon: ResetIcon
          }) : null]
        })
      }), schemaTypes.length > 1 ? /* @__PURE__ */jsx(Flex, {
        align: "center",
        gap: 1,
        children: schemaTypes.map(typeName => {
          var _a, _b;
          const schemaType = schema.get(typeName);
          if (!schemaType) {
            return null;
          }
          return /* @__PURE__ */jsx(Button, {
            padding: 3,
            fontSize: 1,
            text: (_a = schemaType == null ? void 0 : schemaType.title) != null ? _a : typeName,
            icon: (_b = schemaType == null ? void 0 : schemaType.icon) != null ? _b : void 0,
            mode: selectedSchemaTypes.includes(typeName) ? "default" : "ghost",
            onClick: () => toggleSelectedSchemaType(typeName)
          }, typeName);
        })
      }) : null]
    })
  });
}
function Status(props) {
  const {
    text,
    icon
  } = props;
  const Icon = icon;
  return /* @__PURE__ */jsx(Tooltip, {
    portal: true,
    content: /* @__PURE__ */jsx(Box, {
      padding: 2,
      children: /* @__PURE__ */jsx(Text, {
        size: 1,
        children: text
      })
    }),
    children: /* @__PURE__ */jsx(Text, {
      size: 1,
      children: /* @__PURE__ */jsx(Icon, {})
    })
  });
}
var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", {
  value: __freeze$1(raw || cooked.slice())
}));
var _a$1;
const StyledStickyCard = styled(Card)(() => css(_a$1 || (_a$1 = __template$1(["\n    position: sticky;\n    top: 0;\n    z-index: 1;\n  "]))));
function StateTitle(props) {
  const {
    state,
    requireAssignment,
    userRoleCanDrop,
    isDropDisabled,
    draggingFrom,
    documentCount
  } = props;
  let tone = "default";
  const isSource = draggingFrom === state.id;
  if (draggingFrom) {
    tone = isDropDisabled || isSource ? "default" : "positive";
  }
  return /* @__PURE__ */jsx(StyledStickyCard, {
    paddingY: 4,
    padding: 3,
    tone: "inherit",
    children: /* @__PURE__ */jsxs(Flex, {
      gap: 3,
      align: "center",
      children: [/* @__PURE__ */jsx(Badge, {
        mode: draggingFrom && !isDropDisabled || isSource ? "default" : "outline",
        tone,
        muted: !userRoleCanDrop || isDropDisabled,
        children: state.title
      }), userRoleCanDrop ? null : /* @__PURE__ */jsx(Status, {
        text: "You do not have permissions to move documents to this State",
        icon: InfoOutlineIcon
      }), requireAssignment ? /* @__PURE__ */jsx(Status, {
        text: "You must be assigned to the document to move documents to this State",
        icon: UserIcon
      }) : null, /* @__PURE__ */jsx(Box, {
        flex: 1,
        children: documentCount > 0 ? /* @__PURE__ */jsx(Text, {
          weight: "semibold",
          align: "right",
          size: 1,
          children: documentCount
        }) : null
      })]
    })
  });
}
function generateMiddleValue(ranks) {
  if (!ranks.some(rank => !rank)) {
    return ranks;
  }
  const firstUndefined = ranks.findIndex(rank => !rank);
  const firstDefinedAfter = ranks.findIndex((rank, index) => rank && index > firstUndefined);
  const firstDefinedBefore = ranks.findLastIndex((rank, index) => rank && index < firstUndefined);
  if (firstDefinedAfter === -1 || firstDefinedBefore === -1) {
    throw new Error("Unable to generate middle value between indexes ".concat(firstDefinedBefore, " and ").concat(firstDefinedAfter));
  }
  const beforeRank = ranks[firstDefinedBefore];
  const afterRank = ranks[firstDefinedAfter];
  if (!beforeRank || typeof beforeRank === "undefined" || !afterRank || typeof afterRank === "undefined") {
    throw new Error("Unable to generate middle value between indexes ".concat(firstDefinedBefore, " and ").concat(firstDefinedAfter));
  }
  const between = beforeRank.between(afterRank);
  const middle = Math.floor((firstDefinedAfter + firstDefinedBefore) / 2);
  if (ranks[middle]) {
    throw new Error("Should not have overwritten value at index ".concat(middle));
  }
  ranks[middle] = between;
  return ranks;
}
function generateMultipleOrderRanks(count, start, end) {
  let ranks = [...Array(count)];
  const rankStart = start != null ? start : LexoRank.min().genNext().genNext();
  const rankEnd = end != null ? end : LexoRank.max().genPrev().genPrev();
  ranks[0] = rankStart;
  ranks[count - 1] = rankEnd;
  for (let i = 0; i < count; i++) {
    ranks = generateMiddleValue(ranks);
  }
  return ranks.sort((a, b) => a.toString().localeCompare(b.toString()));
}
var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", {
  value: __freeze(raw || cooked.slice())
}));
var _a;
const StyledFloatingCard = styled(Card)(() => css(_a || (_a = __template(["\n    position: fixed;\n    bottom: 0;\n    left: 0;\n    z-index: 1000;\n  "]))));
function FloatingCard(_ref3) {
  let {
    children
  } = _ref3;
  const childrenHaveValues = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return /* @__PURE__ */jsx(AnimatePresence, {
    children: childrenHaveValues ? /* @__PURE__ */jsx(motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      exit: {
        opacity: 0
      },
      children: /* @__PURE__ */jsx(StyledFloatingCard, {
        shadow: 3,
        padding: 3,
        margin: 3,
        radius: 3,
        children: /* @__PURE__ */jsx(Grid, {
          gap: 2,
          children
        })
      })
    }, "floater") : null
  });
}
function Verify(props) {
  const {
    data,
    userList,
    states
  } = props;
  const client = useClient({
    apiVersion: API_VERSION
  });
  const toast = useToast();
  const documentsWithoutValidMetadataIds = (data == null ? void 0 : data.length) ? data.reduce((acc, cur) => {
    var _a;
    const {
      documentId,
      state
    } = (_a = cur._metadata) != null ? _a : {};
    const stateExists = states.find(s => s.id === state);
    return !stateExists && documentId ? [...acc, documentId] : acc;
  }, []) : [];
  const documentsWithInvalidUserIds = (data == null ? void 0 : data.length) && (userList == null ? void 0 : userList.length) ? data.reduce((acc, cur) => {
    var _a;
    const {
      documentId,
      assignees
    } = (_a = cur._metadata) != null ? _a : {};
    const allAssigneesExist = (assignees == null ? void 0 : assignees.length) ? assignees == null ? void 0 : assignees.every(a => userList.find(u => u.id === a)) : true;
    return !allAssigneesExist && documentId ? [...acc, documentId] : acc;
  }, []) : [];
  const documentsWithoutOrderIds = (data == null ? void 0 : data.length) ? data.reduce((acc, cur) => {
    var _a;
    const {
      documentId,
      orderRank
    } = (_a = cur._metadata) != null ? _a : {};
    return !orderRank && documentId ? [...acc, documentId] : acc;
  }, []) : [];
  const documentsWithDuplicatedOrderIds = (data == null ? void 0 : data.length) ? data.reduce((acc, cur) => {
    var _a;
    const {
      documentId,
      orderRank
    } = (_a = cur._metadata) != null ? _a : {};
    return orderRank && data.filter(d => {
      var _a2;
      return ((_a2 = d._metadata) == null ? void 0 : _a2.orderRank) === orderRank;
    }).length > 1 && documentId ? [...acc, documentId] : acc;
  }, []) : [];
  const correctDocuments = React.useCallback(async ids => {
    toast.push({
      title: "Correcting...",
      status: "info"
    });
    const tx = ids.reduce((item, documentId) => {
      return item.patch("workflow-metadata.".concat(documentId), {
        set: {
          state: states[0].id
        }
      });
    }, client.transaction());
    await tx.commit();
    toast.push({
      title: "Corrected ".concat(ids.length === 1 ? "1 Document" : "".concat(ids.length, " Documents")),
      status: "success"
    });
  }, [client, states, toast]);
  const removeUsersFromDocuments = React.useCallback(async ids => {
    toast.push({
      title: "Removing users...",
      status: "info"
    });
    const tx = ids.reduce((item, documentId) => {
      var _a, _b;
      const {
        assignees
      } = (_b = (_a = data.find(d => d._id === documentId)) == null ? void 0 : _a._metadata) != null ? _b : {};
      const validAssignees = (assignees == null ? void 0 : assignees.length) ?
      // eslint-disable-next-line max-nested-callbacks
      assignees.filter(a => {
        var _a2;
        return (_a2 = userList.find(u => u.id === a)) == null ? void 0 : _a2.id;
      }) : [];
      return item.patch("workflow-metadata.".concat(documentId), {
        set: {
          assignees: validAssignees
        }
      });
    }, client.transaction());
    await tx.commit();
    toast.push({
      title: "Corrected ".concat(ids.length === 1 ? "1 Document" : "".concat(ids.length, " Documents")),
      status: "success"
    });
  }, [client, data, toast, userList]);
  const addOrderToDocuments = React.useCallback(async ids => {
    toast.push({
      title: "Adding ordering...",
      status: "info"
    });
    const [firstOrder, secondOrder] = [...data].slice(0, 2).map(d => {
      var _a;
      return (_a = d._metadata) == null ? void 0 : _a.orderRank;
    });
    const minLexo = firstOrder ? LexoRank.parse(firstOrder) : void 0;
    const maxLexo = secondOrder ? LexoRank.parse(secondOrder) : void 0;
    const ranks = generateMultipleOrderRanks(ids.length, minLexo, maxLexo);
    const tx = client.transaction();
    for (let index = 0; index < ids.length; index += 1) {
      tx.patch("workflow-metadata.".concat(ids[index]), {
        set: {
          orderRank: ranks[index].toString()
        }
      });
    }
    await tx.commit();
    toast.push({
      title: "Added order to ".concat(ids.length === 1 ? "1 Document" : "".concat(ids.length, " Documents")),
      status: "success"
    });
  }, [data, client, toast]);
  const resetOrderOfAllDocuments = React.useCallback(async ids => {
    toast.push({
      title: "Adding ordering...",
      status: "info"
    });
    const ranks = generateMultipleOrderRanks(ids.length);
    const tx = client.transaction();
    for (let index = 0; index < ids.length; index += 1) {
      tx.patch("workflow-metadata.".concat(ids[index]), {
        set: {
          orderRank: ranks[index].toString()
        }
      });
    }
    await tx.commit();
    toast.push({
      title: "Added order to ".concat(ids.length === 1 ? "1 Document" : "".concat(ids.length, " Documents")),
      status: "success"
    });
  }, [data, client, toast]);
  const orphanedMetadataDocumentIds = React.useMemo(() => {
    return data.length ? data.filter(doc => !(doc == null ? void 0 : doc._id)).map(doc => doc._metadata.documentId) : [];
  }, [data]);
  const handleOrphans = React.useCallback(() => {
    toast.push({
      title: "Removing orphaned metadata...",
      status: "info"
    });
    const tx = client.transaction();
    orphanedMetadataDocumentIds.forEach(id => {
      tx.delete("workflow-metadata.".concat(id));
    });
    tx.commit();
    toast.push({
      title: "Removed ".concat(orphanedMetadataDocumentIds.length, " orphaned metadata documents"),
      status: "success"
    });
  }, [client, orphanedMetadataDocumentIds, toast]);
  return /* @__PURE__ */jsxs(FloatingCard, {
    children: [documentsWithoutValidMetadataIds.length > 0 ? /* @__PURE__ */jsx(Button, {
      tone: "caution",
      mode: "ghost",
      onClick: () => correctDocuments(documentsWithoutValidMetadataIds),
      text: documentsWithoutValidMetadataIds.length === 1 ? "Correct 1 Document State" : "Correct ".concat(documentsWithoutValidMetadataIds.length, " Document States")
    }) : null, documentsWithInvalidUserIds.length > 0 ? /* @__PURE__ */jsx(Button, {
      tone: "caution",
      mode: "ghost",
      onClick: () => removeUsersFromDocuments(documentsWithInvalidUserIds),
      text: documentsWithInvalidUserIds.length === 1 ? "Remove Invalid Users from 1 Document" : "Remove Invalid Users from ".concat(documentsWithInvalidUserIds.length, " Documents")
    }) : null, documentsWithoutOrderIds.length > 0 ? /* @__PURE__ */jsx(Button, {
      tone: "caution",
      mode: "ghost",
      onClick: () => addOrderToDocuments(documentsWithoutOrderIds),
      text: documentsWithoutOrderIds.length === 1 ? "Set Order for 1 Document" : "Set Order for ".concat(documentsWithoutOrderIds.length, " Documents")
    }) : null, documentsWithDuplicatedOrderIds.length > 0 ? /* @__PURE__ */jsxs(Fragment, {
      children: [/* @__PURE__ */jsx(Button, {
        tone: "caution",
        mode: "ghost",
        onClick: () => addOrderToDocuments(documentsWithDuplicatedOrderIds),
        text: documentsWithDuplicatedOrderIds.length === 1 ? "Set Unique Order for 1 Document" : "Set Unique Order for ".concat(documentsWithDuplicatedOrderIds.length, " Documents")
      }), /* @__PURE__ */jsx(Button, {
        tone: "caution",
        mode: "ghost",
        onClick: () => resetOrderOfAllDocuments(data.map(doc => {
          var _a;
          return String((_a = doc._metadata) == null ? void 0 : _a.documentId);
        })),
        text: data.length === 1 ? "Reset Order for 1 Document" : "Reset Order for all ".concat(data.length, " Documents")
      })]
    }) : null, orphanedMetadataDocumentIds.length > 0 ? /* @__PURE__ */jsx(Button, {
      text: "Cleanup orphaned metadata",
      onClick: handleOrphans,
      tone: "caution",
      mode: "ghost"
    }) : null]
  });
}
function WorkflowTool(props) {
  var _a, _b, _c;
  const {
    schemaTypes = [],
    states = [],
    filters = null
  } = (_b = (_a = props == null ? void 0 : props.tool) == null ? void 0 : _a.options) != null ? _b : {};
  const isDarkMode = useTheme().sanity.color.dark;
  const defaultCardTone = isDarkMode ? "default" : "transparent";
  const toast = useToast();
  const userList = useProjectUsers({
    apiVersion: API_VERSION
  });
  const user = useCurrentUser();
  const userRoleNames = ((_c = user == null ? void 0 : user.roles) == null ? void 0 : _c.length) ? user == null ? void 0 : user.roles.map(r => r.name) : [];
  const filtered = filters == null ? void 0 : filters(user);
  const {
    workflowData,
    operations
  } = useWorkflowDocuments(schemaTypes, filtered);
  const [patchingIds, setPatchingIds] = React.useState([]);
  const {
    data,
    loading,
    error
  } = workflowData;
  const {
    move
  } = operations;
  const [undroppableStates, setUndroppableStates] = React.useState([]);
  const [draggingFrom, setDraggingFrom] = React.useState("");
  const handleDragStart = React.useCallback(start => {
    var _a2, _b2;
    const {
      draggableId,
      source
    } = start;
    const {
      droppableId: currentStateId
    } = source;
    setDraggingFrom(currentStateId);
    const document = data.find(item => {
      var _a3;
      return ((_a3 = item._metadata) == null ? void 0 : _a3.documentId) === draggableId;
    });
    const state = states.find(s => s.id === currentStateId);
    if (!document || !state) return;
    const undroppableStateIds = [];
    const statesThatRequireAssignmentIds = states.filter(s => s.requireAssignment).map(s => s.id);
    if (statesThatRequireAssignmentIds.length) {
      const documentAssignees = (_b2 = (_a2 = document._metadata) == null ? void 0 : _a2.assignees) != null ? _b2 : [];
      const userIsAssignedToDocument = (user == null ? void 0 : user.id) ? documentAssignees.includes(user.id) : false;
      if (!userIsAssignedToDocument) {
        undroppableStateIds.push(...statesThatRequireAssignmentIds);
      }
    }
    const statesThatCannotBeTransitionedToIds = state.transitions && state.transitions.length ? states.filter(s => {
      var _a3;
      return !((_a3 = state.transitions) == null ? void 0 : _a3.includes(s.id));
    }).map(s => s.id) : [];
    if (statesThatCannotBeTransitionedToIds.length) {
      undroppableStateIds.push(...statesThatCannotBeTransitionedToIds);
    }
    const undroppableExceptSelf = undroppableStateIds.filter(id => id !== currentStateId);
    if (undroppableExceptSelf.length) {
      setUndroppableStates(undroppableExceptSelf);
    }
  }, [data, states, user]);
  const handleDragEnd = React.useCallback(async result => {
    var _a2, _b2, _c2, _d, _e, _f;
    setUndroppableStates([]);
    setDraggingFrom("");
    const {
      draggableId,
      source,
      destination
    } = result;
    if (
    // No destination?
    !destination ||
    // No change in position?
    destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    const destinationStateItems = [...filterItemsAndSort(data, destination.droppableId, [], null)];
    const destinationStateIndex = states.findIndex(s => s.id === destination.droppableId);
    const globalStateMinimumRank = data[0]._metadata.orderRank;
    const globalStateMaximumRank = data[data.length - 1]._metadata.orderRank;
    let newOrder;
    if (!destinationStateItems.length) {
      if (destinationStateIndex === 0) {
        newOrder = LexoRank.min().toString();
      } else {
        newOrder = LexoRank.min().genNext().toString();
      }
    } else if (destination.index === 0) {
      const firstItemOrderRank = (_b2 = (_a2 = [...destinationStateItems].shift()) == null ? void 0 : _a2._metadata) == null ? void 0 : _b2.orderRank;
      if (firstItemOrderRank && typeof firstItemOrderRank === "string") {
        newOrder = LexoRank.parse(firstItemOrderRank).genPrev().toString();
      } else if (destinationStateIndex === 0) {
        newOrder = LexoRank.min().toString();
      } else {
        newOrder = LexoRank.parse(globalStateMinimumRank).between(LexoRank.min()).toString();
      }
    } else if (destination.index + 1 === destinationStateItems.length) {
      const lastItemOrderRank = (_d = (_c2 = [...destinationStateItems].pop()) == null ? void 0 : _c2._metadata) == null ? void 0 : _d.orderRank;
      if (lastItemOrderRank && typeof lastItemOrderRank === "string") {
        newOrder = LexoRank.parse(lastItemOrderRank).genNext().toString();
      } else if (destinationStateIndex === states.length - 1) {
        newOrder = LexoRank.max().toString();
      } else {
        newOrder = LexoRank.parse(globalStateMaximumRank).between(LexoRank.min()).toString();
      }
    } else {
      const itemBefore = destinationStateItems[destination.index - 1];
      const itemBeforeRank = (_e = itemBefore == null ? void 0 : itemBefore._metadata) == null ? void 0 : _e.orderRank;
      let itemBeforeRankParsed;
      if (itemBeforeRank) {
        itemBeforeRankParsed = LexoRank.parse(itemBeforeRank);
      } else if (destinationStateIndex === 0) {
        itemBeforeRankParsed = LexoRank.min();
      } else {
        itemBeforeRankParsed = LexoRank.parse(globalStateMinimumRank);
      }
      const itemAfter = destinationStateItems[destination.index];
      const itemAfterRank = (_f = itemAfter == null ? void 0 : itemAfter._metadata) == null ? void 0 : _f.orderRank;
      let itemAfterRankParsed;
      if (itemAfterRank) {
        itemAfterRankParsed = LexoRank.parse(itemAfterRank);
      } else if (destinationStateIndex === states.length - 1) {
        itemAfterRankParsed = LexoRank.max();
      } else {
        itemAfterRankParsed = LexoRank.parse(globalStateMaximumRank);
      }
      newOrder = itemBeforeRankParsed.between(itemAfterRankParsed).toString();
    }
    setPatchingIds([...patchingIds, draggableId]);
    toast.push({
      status: "info",
      title: "Updating document state..."
    });
    await move(draggableId, destination, states, newOrder);
    setPatchingIds(ids => ids.filter(id => id !== draggableId));
  }, [data, patchingIds, toast, move, states]);
  const uniqueAssignedUsers = React.useMemo(() => {
    const uniqueUserIds = data.reduce((acc, item) => {
      var _a2;
      const {
        assignees = []
      } = (_a2 = item._metadata) != null ? _a2 : {};
      const newAssignees = (assignees == null ? void 0 : assignees.length) ? assignees.filter(a => !acc.includes(a)) : [];
      return newAssignees.length ? [...acc, ...newAssignees] : acc;
    }, []);
    return userList.filter(u => uniqueUserIds.includes(u.id));
  }, [data, userList]);
  const [selectedUserIds, setSelectedUserIds] = React.useState(uniqueAssignedUsers.map(u => u.id));
  const toggleSelectedUser = React.useCallback(userId => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]);
  }, []);
  const resetSelectedUsers = React.useCallback(() => {
    setSelectedUserIds([]);
  }, []);
  const [selectedSchemaTypes, setSelectedSchemaTypes] = React.useState(schemaTypes);
  const toggleSelectedSchemaType = React.useCallback(schemaType => {
    setSelectedSchemaTypes(prev => prev.includes(schemaType) ? prev.filter(u => u !== schemaType) : [...prev, schemaType]);
  }, []);
  const [invalidDocumentIds, setInvalidDocumentIds] = React.useState([]);
  const toggleInvalidDocumentId = React.useCallback((docId, action) => {
    setInvalidDocumentIds(prev => action === "ADD" ? [...prev, docId] : prev.filter(id => id !== docId));
  }, []);
  const Clone = React.useCallback((provided, snapshot, rubric) => {
    const item = data.find(doc => {
      var _a2;
      return ((_a2 = doc == null ? void 0 : doc._metadata) == null ? void 0 : _a2.documentId) === rubric.draggableId;
    });
    return /* @__PURE__ */jsx("div", {
      ...provided.draggableProps,
      ...provided.dragHandleProps,
      ref: provided.innerRef,
      children: item ? /* @__PURE__ */jsx(DocumentCard, {
        isDragDisabled: false,
        isPatching: false,
        userRoleCanDrop: true,
        isDragging: snapshot.isDragging,
        item,
        states,
        toggleInvalidDocumentId,
        userList
      }) : /* @__PURE__ */jsx(Feedback, {
        title: "Item not found",
        tone: "caution"
      })
    });
  }, [data, states, toggleInvalidDocumentId, userList]);
  if (!(states == null ? void 0 : states.length)) {
    return /* @__PURE__ */jsx(Container, {
      width: 1,
      padding: 5,
      children: /* @__PURE__ */jsx(Feedback, {
        tone: "caution",
        title: "Plugin options error",
        description: "No States defined in plugin config"
      })
    });
  }
  if (error && !data.length) {
    return /* @__PURE__ */jsx(Container, {
      width: 1,
      padding: 5,
      children: /* @__PURE__ */jsx(Feedback, {
        tone: "critical",
        title: "Error querying for Workflow documents"
      })
    });
  }
  return /* @__PURE__ */jsxs(Flex, {
    direction: "column",
    height: "fill",
    overflow: "hidden",
    children: [/* @__PURE__ */jsx(Verify, {
      data,
      userList,
      states
    }), /* @__PURE__ */jsx(Filters, {
      uniqueAssignedUsers,
      selectedUserIds,
      toggleSelectedUser,
      resetSelectedUsers,
      schemaTypes,
      selectedSchemaTypes,
      toggleSelectedSchemaType
    }), /* @__PURE__ */jsx(DragDropContext, {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      children: /* @__PURE__ */jsx(Grid, {
        columns: states.length,
        height: "fill",
        children: states.map((state, stateIndex) => {
          var _a2, _b2;
          const userRoleCanDrop = ((_a2 = state == null ? void 0 : state.roles) == null ? void 0 : _a2.length) ? arraysContainMatchingString(state.roles, userRoleNames) : true;
          const isDropDisabled = !userRoleCanDrop || undroppableStates.includes(state.id);
          return /* @__PURE__ */jsx(Card, {
            borderLeft: stateIndex > 0,
            tone: defaultCardTone,
            children: /* @__PURE__ */jsxs(Flex, {
              direction: "column",
              height: "fill",
              children: [/* @__PURE__ */jsx(StateTitle, {
                state,
                requireAssignment: (_b2 = state.requireAssignment) != null ? _b2 : false,
                userRoleCanDrop,
                isDropDisabled,
                draggingFrom,
                documentCount: filterItemsAndSort(data, state.id, selectedUserIds, selectedSchemaTypes).length
              }), /* @__PURE__ */jsx(Box, {
                flex: 1,
                children: /* @__PURE__ */jsx(Droppable, {
                  droppableId: state.id,
                  isDropDisabled,
                  mode: "virtual",
                  renderClone: Clone,
                  children: (provided, snapshot) => /* @__PURE__ */jsxs(Card, {
                    ref: provided.innerRef,
                    tone: snapshot.isDraggingOver ? "primary" : defaultCardTone,
                    height: "fill",
                    children: [loading ? /* @__PURE__ */jsx(Flex, {
                      padding: 5,
                      align: "center",
                      justify: "center",
                      children: /* @__PURE__ */jsx(Spinner, {
                        muted: true
                      })
                    }) : null, /* @__PURE__ */jsx(DocumentList, {
                      data,
                      invalidDocumentIds,
                      patchingIds,
                      selectedSchemaTypes,
                      selectedUserIds,
                      state,
                      states,
                      toggleInvalidDocumentId,
                      user,
                      userList,
                      userRoleCanDrop
                    })]
                  })
                })
              })]
            })
          }, state.id);
        })
      })
    })]
  });
}
const workflowTool = options => ({
  name: "workflow",
  title: "Workflow",
  component: WorkflowTool,
  icon: SplitVerticalIcon,
  options
});
const workflow = definePlugin(function () {
  let config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_CONFIG;
  const {
    schemaTypes,
    states,
    filters
  } = {
    ...DEFAULT_CONFIG,
    ...config
  };
  if (!(states == null ? void 0 : states.length)) {
    throw new Error('Workflow plugin: Missing "states" in config');
  }
  if (!(schemaTypes == null ? void 0 : schemaTypes.length)) {
    throw new Error('Workflow plugin: Missing "schemaTypes" in config');
  }
  return {
    name: "sanity-plugin-workflow",
    schema: {
      types: [metadata(states)]
    },
    // TODO: Remove 'workflow.metadata' from list of new document types
    // ...
    studio: {
      components: {
        layout: props => WorkflowProvider({
          ...props,
          workflow: {
            schemaTypes,
            states,
            filters
          }
        })
      }
    },
    form: {
      components: {
        input: props => {
          if (props.id === "root" && isObjectInputProps(props) && schemaTypes.includes(props.schemaType.name)) {
            return WorkflowSignal(props);
          }
          return props.renderDefault(props);
        }
      }
    },
    document: {
      actions: (prev, context) => {
        if (!schemaTypes.includes(context.schemaType)) {
          return prev;
        }
        return [props => BeginWorkflow(props), props => AssignWorkflow(props), ...states.map(state => props => UpdateWorkflow(props, state)), props => CompleteWorkflow(props), ...prev];
      },
      badges: (prev, context) => {
        if (!schemaTypes.includes(context.schemaType)) {
          return prev;
        }
        const {
          documentId,
          currentUser
        } = context;
        if (!documentId) {
          return prev;
        }
        return [() => StateBadge(documentId), () => AssigneesBadge(documentId, currentUser), ...prev];
      }
    },
    tools: [
    // TODO: These configs could be read from Context
    workflowTool({
      schemaTypes,
      states,
      filters
    })]
  };
});
export { workflow };
//# sourceMappingURL=index.esm.js.map
