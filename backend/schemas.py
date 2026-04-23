from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class DashboardStatOut(BaseModel):
    id: str
    user_id: str
    total_competitions: int
    teams_joined: int

    class Config:
        from_attributes = True


class CompetitionOut(BaseModel):
    id: str
    category: str
    status: str
    title: str
    description: str
    stat1_label: str
    stat1_value: str
    stat2_label: str
    stat2_value: str
    footer: str
    muted: bool

    class Config:
        from_attributes = True


class RecentCompetitionOut(BaseModel):
    id: str
    user_id: str
    title: str
    type: str
    status: str
    score: str
    sync: str
    icon: str

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    time: str
    highlighted: bool
    actions: bool

    class Config:
        from_attributes = True