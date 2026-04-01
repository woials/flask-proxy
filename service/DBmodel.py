from collections import defaultdict
import json

from sqlalchemy import Index, create_engine, DateTime, select, Column, String, Integer
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.sqlite import insert
import datetime


DATABASE = 'sqlite:///youtube.db'

# Engineの作成
Engine = create_engine(
    DATABASE,
    echo=False,
    future=True
)
Base = declarative_base()
# sessionmakerの作成 どこでもsessionを同じ設定で作成できる
# 検討:scoped_sessionへの移行
# ▶どこからでも同じsessionを取得できるが、リクエスト終了時にsession.remove()を呼ばないと接続・メモリリークになる
# ただ、現状はwith構文+SessionLocal()を使っているので、ブロックを抜けたらsession.close()が呼ばれるのでリークが発生しないはずだし、
# おそらくscoped_sessionに移行してもコードの複雑さが増すだけなので、現状のままでいいと思う
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=True,
    bind=Engine
)


class Video(Base):
    __tablename__ = 'videos'
    video_id = Column(String, primary_key=True)
    quality = Column(Integer, primary_key=True)
    type = Column(String, primary_key=True)
    title = Column(String)
    duration = Column(Integer)
    file_path = Column(String, nullable=False)
    thumbnail_path = Column(String)
    added_at = Column(DateTime, default=datetime.datetime.now)
    __table_args__ = (
        # 動画と音声で分けることで、動画の解像度と音声のビットレートが同じ場合でも、video_idとqualityの組み合わせが重複しないようにする
        Index("idx_type_video", "type", "video_id"),
        # 解像度・ビットレート違いな同一の動画・音声を１つの検索結果で表示するために、video_idとqualityの組み合わせでインデックスを作成する
        Index("idx_video_quality", "video_id", "quality"),
    )


Base.metadata.create_all(bind=Engine)

r"""
SQLAlchemyを使ってselect文を実行する方法
1. SessionLocal()を用いてセッションを作成する
2. select()関数を使ってクエリを生成する
3. session.scalars()を用いてクエリを実行し、結果を取得する

session.scalars()は、クエリの結果から１つのカラムの値を取り出すメソッド
session.execute(select(Video))だけだと、[(Video1), (Video2), ...]という1要素のタプルが並んで返ってくる
.scalars()を使うと、[Video1, Video2, ...]というVideoオブジェクトのリストが返ってくる
"""


def get_videos_by_type(isVideo: bool):
    # sessionmakerで設定した引数でSessionを作成する
    with SessionLocal() as session:
        # 1.select()関数を使ってクエリを生成する
        stmt = select(Video).where(
            Video.type == ("video" if isVideo else "audio"))
        # 2.session.scalars()を用いてクエリを実行し、結果を取得する
        rows = session.scalars(stmt).all()
        # defaultdictは、キーが存在しない場合に自動的に初期値を生成する辞書のサブクラス
        # listやintなどで初期値を指定できる。例えば、defaultdict(list)とすると、存在しないキーにアクセスしたときに自動的に空のリストが生成される
        grouped = defaultdict(list)
        # 3.動画IDごとに動画をグループ化する
        # 動画IDと解像度の組み合わせで重複しないようにしているので、動画IDごとにグループ化すれば、同一の動画で解像度違いのものをまとめて表示できる
        for v in rows:
            grouped[v.video_id].append(v)
        return grouped


r"""
TIPS:stmt
stmtはステートメント(statement)の略で、一般的にDB操作を扱うためのオブジェクトを指すことが多い
PHPでも$stmtはステートメントを表す変数名としてよく使われる
SQL文をそのまま文字列で書くと、SQLインジェクションのリスクがあるので、命令の枠組み(Statement)を
作ってから値をバインドする方法が推奨される(prepared statement)
"""


def store_videos(item: dict):
    with SessionLocal() as session:
        try:
            added_at = datetime.datetime.fromisoformat(item["added_at"])
            if item["type"] == "video":
                quality = int(item["quality"].replace("p", ""))
            else:
                quality = int(item["quality"].replace("kbps", ""))
            stmt = insert(Video).values(
                video_id=item["video_id"],
                quality=quality,
                type=item["type"],
                title=item["title"],
                duration=item["duration"],
                file_path=item["file_path"],
                thumbnail_path=item["thumbnail_path"],
                added_at=added_at
            ).on_conflict_do_update(
                # video_idとqualityとtypeの組み合わせが重複したら更新する
                index_elements=["video_id", "quality", "type"],
                set_={
                    "title": item["title"],
                    "duration": item["duration"],
                    "file_path": item["file_path"],
                    "thumbnail_path": item["thumbnail_path"],
                    "added_at": added_at
                }
            )
            session.execute(stmt)

            session.commit()
        except Exception as e:
            session.rollback()
            print(f"データの保存に失敗しました: {e}")
            raise
