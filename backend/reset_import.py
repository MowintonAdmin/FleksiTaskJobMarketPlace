import asyncio, asyncpg

async def reset():
    conn = await asyncpg.connect(host='postgres', user='fleksi', password='password', database='flekxitask')
    r1 = await conn.execute("DELETE FROM task_sessions WHERE source = 'IMPORTED'")
    r2 = await conn.execute("DELETE FROM users WHERE source = 'IMPORTED'")
    r3 = await conn.execute("DELETE FROM import_logs")
    print(f'Deleted: {r1} sessions, {r2} users, {r3} logs')
    await conn.close()

asyncio.run(reset())