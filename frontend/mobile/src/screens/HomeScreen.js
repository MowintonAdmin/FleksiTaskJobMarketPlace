import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, Platform,
} from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { fetchTasks, setFilters } from '../store/slices/taskSlice'
import TaskCard from '../components/TaskCard'

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch()
  const { items, loading, filters, total } = useSelector((s) => s.tasks)
  const [locationInput, setLocationInput] = useState('')

  useEffect(() => {
    dispatch(fetchTasks({}))
  }, [dispatch])

  const handleSearch = () => {
    dispatch(setFilters({ location: locationInput }))
    dispatch(fetchTasks({ location: locationInput }))
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ FlekxiTask</Text>
        <Text style={styles.subtitle}>{total} tasks available near you</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by location..."
          value={locationInput}
          onChangeText={setLocationInput}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No tasks found</Text>
            </View>
          }
          onEndReached={() => {}}
          onEndReachedThreshold={0.5}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#2563eb', paddingTop: Platform.OS === 'android' ? 40 : 16, paddingBottom: 16, paddingHorizontal: 16 },
  logo: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, color: '#bfdbfe', marginTop: 2 },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  searchInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  searchBtn: { backgroundColor: '#2563eb', borderRadius: 10, width: 42, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontSize: 16 },
  list: { padding: 12, gap: 10 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
})
