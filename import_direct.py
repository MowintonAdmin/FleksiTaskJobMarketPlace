import openpyxl
import uuid
from datetime import datetime, timezone, timedelta
import sys
sys.path.insert(0, '/app')
import asyncio
import re

from app.database import AsyncSessionLocal
from app.models.user import User, DataSource
from app.models.task_session import TaskSession, SessionStatus
from app.models.task import Task, TaskStatus
from sqlalchemy import select

PLACEHOLDER_TASK_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

def parse_excel(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['Feb - June Tracker (Cleaned)']
    
    workers = {}
    sessions = []
    
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        
        pid = str(row[0]).strip() if row[0] is not None else None
        nric = str(row[1]).strip() if row[1] is not None else None
        date_val = row[2]
        project_session = str(row[5]).strip() if row[5] is not None else None
        body_height_val = row[6]
        nature = str(row[7]).strip() if row[7] is not None else None
        activity = str(row[8]).strip() if row[8] is not None else None
        environment = str(row[9]).strip() if row[9] is not None else None
        device_id = str(row[10]).strip() if row[10] is not None else None
        name = str(row[18]).strip() if row[18] is not None else None
        full_name = str(row[19]).strip() if row[19] is not None else None
        hours_worked = float(row[20]) if row[20] is not None else 0
        total_payout = float(row[21]) if row[21] is not None else 0
        phone = str(row[22]).strip() if len(row) > 22 and row[22] is not None else None

        if not pid or not full_name:
            continue

        if phone:
            phone = re.sub(r'[^0-9+]', '', phone)

        if pid not in workers:
            workers[pid] = {
                'pid': pid, 'nric': nric or '', 'full_name': full_name,
                'phone': phone or '', 'body_height': float(body_height_val) if body_height_val else None,
                'name': name or full_name,
            }

        hours = hours_worked if hours_worked else 0
        if isinstance(date_val, datetime):
            check_in = date_val.replace(hour=8, minute=0, second=0, tzinfo=timezone.utc)
            check_out = check_in + timedelta(minutes=max(hours * 60, 0))
        else:
            check_in = None
            check_out = None

        sessions.append({
            'pid': pid, 'nature': nature or activity or 'Work',
            'activity': activity or '', 'environment': environment or '',
            'check_in': check_in, 'check_out': check_out,
            'hours': hours, 'payout': total_payout,
            'project_session': project_session or '',
        })

    return workers, sessions


async def import_data():
    print("Parsing Excel...")
    workers, sessions = parse_excel('/app/import_data.xlsx')
    print(f"Found {len(workers)} unique workers, {len(sessions)} sessions")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.is_admin == True))
        admin = result.scalar_one_or_none()
        if not admin:
            print("Error: No admin user found")
            return

        # Get or create placeholder task
        task_result = await db.execute(select(Task).where(Task.id == PLACEHOLDER_TASK_ID))
        task = task_result.scalar_one_or_none()
        if not task:
            task = Task(
                id=PLACEHOLDER_TASK_ID,
                title="Historical Record",
                description="Imported session data",
                pay_rate_per_minute=1/6,
                estimated_duration_minutes=480,
                max_applicants=9999,
                status=TaskStatus.COMPLETED,
                employer_id=admin.id,
            )
            db.add(task)
            await db.flush()

        created = 0
        matched = 0
        worker_map = {}

        for pid, info in workers.items():
            email = f"legacy-{pid}@import.local"

            existing = await db.execute(select(User).where(User.legacy_participant_id == pid))
            user = existing.scalar_one_or_none()

            if not user and info['nric']:
                existing = await db.execute(select(User).where(User.nric_passport == info['nric']))
                user = existing.scalar_one_or_none()

            if user:
                user.legacy_participant_id = pid
                if info['phone'] and not user.phone:
                    user.phone = info['phone']
                if info['full_name'] and not user.full_name:
                    user.full_name = info['full_name']
                matched += 1
            else:
                user = User(
                    email=email, full_name=info['full_name'],
                    source=DataSource.IMPORTED, legacy_participant_id=pid,
                    is_active=False, is_verified=False, verification_status="imported",
                    phone=info['phone'] or None,
                    nric_passport=info['nric'] if info['nric'] else None,
                    body_height_cm=info['body_height'],
                )
                db.add(user)
                created += 1

            await db.flush()
            worker_map[pid] = user.id

        print(f"Workers: {created} created, {matched} matched")

        scount = 0
        for s in sessions:
            uid = worker_map.get(s['pid'])
            if not uid:
                continue
            payout = s['payout'] if s['payout'] > 0 else s['hours'] * 10

            ts = TaskSession(
                task_id=PLACEHOLDER_TASK_ID, worker_id=uid,
                checked_in_at=s['check_in'], checked_out_at=s['check_out'],
                status=SessionStatus.SETTLED, earnings=round(payout, 2),
                source=DataSource.IMPORTED,
                nature_of_work=s['nature'],
                work_environment=s['environment'],
                proof_notes=f"Work: {s['activity']} | Env: {s['environment']} | Session: {s.get('project_session','')}",
            )
            db.add(ts)
            scount += 1
            if scount % 300 == 0:
                await db.flush()
                print(f"  {scount} sessions...")

        await db.commit()
        print(f"\nSessions: {scount} imported")
        print("✅ IMPORT COMPLETE!")
        print(f"  Workers created: {created}")
        print(f"  Workers matched: {matched}")
        print(f"  Sessions imported: {scount}")


if __name__ == '__main__':
    asyncio.run(import_data())