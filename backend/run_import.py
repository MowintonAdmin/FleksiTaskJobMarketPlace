import asyncio
import sys
sys.path.insert(0, '/app')

async def run_import():
    from app.database import AsyncSessionLocal
    from sqlalchemy import select, func
    from app.models.user import User
    from app.models.task_session import TaskSession
    from app.models.import_log import ImportLog
    from app.services.data_import import ImportService
    
    async with AsyncSessionLocal() as db:
        # Get admin
        result = await db.execute(select(User).where(User.email == 'enghoo2004@gmail.com'))
        admin = result.scalar_one_or_none()
        if not admin:
            print("ADMIN NOT FOUND", flush=True)
            return
        
        # Read file
        with open('/app/import_data.xlsx', 'rb') as f:
            content = f.read()
        
        print(f"File size: {len(content)} bytes", flush=True)
        
        service = ImportService(db)
        
        # Preview first
        preview = await service.preview(content, 'data.xlsx')
        print(f"Preview: {preview.total_rows} rows, {preview.valid_rows} valid, {preview.workers_to_create} workers, {preview.sessions_to_import} sessions", flush=True)
        
        import time
        t0 = time.time()
        confirm = await service.confirm(content, 'data.xlsx', admin)
        elapsed = time.time() - t0
        
        print(f"Status: {confirm.status}", flush=True)
        print(f"Workers created: {confirm.workers_created}", flush=True)
        print(f"Workers matched: {confirm.workers_matched}", flush=True)
        print(f"Sessions imported: {confirm.sessions_imported}", flush=True)
        print(f"Time: {elapsed:.2f}s", flush=True)
        print(f"Log ID: {confirm.import_log_id}", flush=True)
        
        await db.commit()
        
        # Verify counts
        v1 = (await db.execute(select(func.count()).select_from(User))).scalar()
        v2 = (await db.execute(select(func.count()).select_from(TaskSession))).scalar()
        v3 = (await db.execute(select(func.count()).select_from(ImportLog))).scalar()
        print(f"Final counts - Users: {v1}, Sessions: {v2}, ImportLogs: {v3}", flush=True)

asyncio.run(run_import())