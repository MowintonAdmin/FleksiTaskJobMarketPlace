import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { tasksApi } from '../api/tasks'

export const fetchTasks = createAsyncThunk('tasks/fetchAll', async (params, { rejectWithValue }) => {
  try {
    return await tasksApi.list(params)
  } catch (err) {
    const detail = err.response?.data?.detail
    if (detail) return rejectWithValue(typeof detail === 'string' ? detail : JSON.stringify(detail))
    if (err.code === 'ERR_NETWORK' || !err.response) return rejectWithValue('Cannot reach the server. Check your connection or try again.')
    return rejectWithValue(`Server error (${err.response.status}). Please try again.`)
  }
})

export const fetchTaskById = createAsyncThunk('tasks/fetchOne', async (id, { rejectWithValue }) => {
  try {
    return await tasksApi.getById(id)
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Task not found')
  }
})

const taskSlice = createSlice({
  name: 'tasks',
  initialState: {
    items: [],
    selectedTask: null,
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
    filters: { location: '', category: '', minPay: '', maxPay: '' },
  },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload } },
    clearSelectedTask: (state) => { state.selectedTask = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.tasks
        state.total = action.payload.total
        state.page = action.payload.page
        state.totalPages = action.payload.total_pages
      })
      .addCase(fetchTasks.rejected, (state, action) => { state.loading = false; state.error = action.payload })
      .addCase(fetchTaskById.pending, (state) => { state.loading = true })
      .addCase(fetchTaskById.fulfilled, (state, action) => { state.loading = false; state.selectedTask = action.payload })
      .addCase(fetchTaskById.rejected, (state, action) => { state.loading = false; state.error = action.payload })
  },
})

export const { setFilters, clearSelectedTask } = taskSlice.actions
export default taskSlice.reducer
