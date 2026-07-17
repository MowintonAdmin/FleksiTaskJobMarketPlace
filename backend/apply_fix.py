import sys
sys.stdout.reconfigure(encoding='utf-8')
path = 'backend/app/api/v1/task_sessions.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'Auto-settled' in content:
    print('Already fixed')
    exit()

old = '''    if active_for_worker.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have another task being tracked. Finish or resume that task before starting a new one.",
        )'''

new = '''    existing_active = active_for_worker.scalar_one_or_none()
    if existing_active:
        task_check = await db.execute(select(Task).where(Task.id == existing_active.task_id))
        existing_task = task_check.scalar_one_or_none()
        if existing_task and existing_task.status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED):
            now = datetime.now(timezone.utc)
            existing_active.checked_out_at = now
            existing_active.status = SessionStatus.COMPLETED
            fixed = round(existing_task.pay_rate_per_minute * existing_task.estimated_duration_minutes, 2)
            existing_active.earnings = fixed
            existing_active.proof_notes = "[Auto-settled - task was already completed/cancelled]"
            db.add(existing_active)
            await db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have another task being tracked. Finish or resume that task before starting a new one.",
            )'''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fix applied!')
else:
    print('Pattern not found')
    idx = content.find('active_for_worker')
    if idx >= 0:
        print(content[idx:idx+300])