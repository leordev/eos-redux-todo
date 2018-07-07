const { createStore } = require('redux')
const axios = require('axios')
const express = require('express')

// actions mapping
const ACTION_ADD_TODO = 'addtodo'
const ACTION_EDIT_TODO = 'edittodo'
const ACTION_TOGGLE_TODO = 'toggletodo'

// config
const INITIAL_BLOCK = 10
const EOS_API = 'http://localhost:8888/v1'
const CONTRACT_ACTIONS = [
  {
    account: 'todo',
    actions: [ACTION_ADD_TODO, ACTION_EDIT_TODO, ACTION_TOGGLE_TODO]
  }
]

// state
const initialState = {
  todos: []
}

// reducer
const appReducer = (state = initialState, action) => {
  switch (action.type) {
    case ACTION_ADD_TODO:
      return addTodoReducer(state, action)
    case ACTION_EDIT_TODO:
      return editTodoReducer(state, action)
    case ACTION_TOGGLE_TODO:
      return toggleTodoReducer(state, action)
    default:
      // return the current state
      // if the action is unknown
      return state
  }
}

const getActor = authorization => {
  return authorization[0].actor
}

const addTodoReducer = (state, action) => {
  // check and do not add new todo if this todo id
  // already exists
  if (state.todos.filter(todo => todo.id === action.data.id).length > 0)
    return state

  const newTodo = {
    id: action.data.id,
    text: action.data.text,
    author: getActor(action.authorization),
    completed: false
  }

  const newTodos = [ ...state.todos, newTodo ]

  return { ...state, todos: newTodos }
}

const editTodoReducer = (state, action) => {
  const updatedTodos = state.todos.map(todo => {
    if (todo.id === action.data.id &&
      todo.author === getActor(action.authorization)) {
      return {
        ...todo,
        text: action.data.text  // update text
      }
    } else {
      return todo
    }
  })

  return { ...state, todos: updatedTodos }
}

const toggleTodoReducer = (state, action) => {
  const updatedTodos = state.todos.map(todo => {
    if (todo.id === action.data.id &&
      todo.author === getActor(action.authorization)) {
      return {
        ...todo,
        completed: !todo.completed  // toggle boolean
      }
    } else {
      return todo
    }
  })

  return { ...state, todos: updatedTodos }
}

// initialize redux store
const store = createStore(appReducer)

// Log the initial state
console.log('>>> initial state: \n', store.getState(), '\n\n')

// Every time the state changes, log it
store.subscribe(() =>
  console.log('>>> updated state: \n', store.getState(), '\n\n')
)

const getChainInfo = () => {
  return axios.get(EOS_API + '/chain/get_info')
  .then(res => res.data)
  .catch(err => console.error(`Fail to get chain info`, err.message))
}

const getBlockInfo = blockNum => {
  return axios.post(
    EOS_API + '/chain/get_block',
    {block_num_or_id: blockNum}
  ).then(res => res.data)
  .catch(err => console.error(`Fail to sync block ${blockNum}`, err.message))
}

const filterAndDispatchAction = (newAction, trxId, block) => {
  const action = {
    type: newAction.name,
    account: newAction.account,
    authorization: newAction.authorization,
    data: newAction.data
  }

  const subscribed = CONTRACT_ACTIONS.find(item => (
    item.account === action.account &&
      item.actions.indexOf(action.type) >= 0
  ))

  if (subscribed) {
    console.log(`\nDispatching Action from Block ${block} - Trx ${trxId}:\n`,
      action, '\n\n')
    store.dispatch(action)
  }

}

const pushActions = block => {
  if (!block || !block.transactions || !block.transactions.length)
    return

  const { transactions } = block

  transactions
    .filter(transaction => {
      return transaction.trx && transaction.trx.transaction &&
        transaction.trx.transaction.actions &&
        transaction.trx.transaction.actions.length > 0
    }).forEach(fullTransaction => {
      const { trx } = fullTransaction
      const { transaction: { actions } } = trx
      actions.forEach(action => filterAndDispatchAction(action, trx.id, block.block_num))
    })
}

let lastChainInfo = null
let nextSyncBlock = INITIAL_BLOCK
let isSyncing = true


const mainLoop = async () => {

  // console.log(`Syncing block ${nextSyncBlock}`)

  if (lastChainInfo == null || nextSyncBlock <= lastChainInfo.head_block_num) {
    lastChainInfo = await getChainInfo() || lastChainInfo
  }

  if (lastChainInfo && lastChainInfo.head_block_num >= nextSyncBlock) {
    const blockInfo = await getBlockInfo(nextSyncBlock)

    if (blockInfo) {
      pushActions(blockInfo)
      nextSyncBlock++;
    }
  }

  isSyncing = !lastChainInfo || lastChainInfo.head_block_num > nextSyncBlock

  isSyncing ? setImmediate(mainLoop)
  : setTimeout(mainLoop, 500) // block production time
}
mainLoop()

// simple express
const expressApp = express()
expressApp.get('/', (req, res) => res.send(store.getState()));
expressApp.listen(3000, () => console.log('Listening on port 3000'));
