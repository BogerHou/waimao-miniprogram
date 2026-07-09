import { CourseDetailResponse, fetchCourseDetail } from '../../utils/api'
import {
  buildAppMessageShare,
  buildTimelineShare,
  enablePageShareMenu,
} from '../../utils/share'
import {
  formatKnowledgeDialogue,
  type KnowledgeDialogueItem,
} from '../../utils/dialogue-format'
import {
  formatKnowledgeContent,
  type KnowledgeCorrectionBlock,
  type KnowledgePhraseItem,
  type KnowledgeTextLine,
} from '../../utils/knowledge-format'

type KnowledgePageData = {
  courseId: string
  courseTitle: string
  loading: boolean
  error: string
  backgroundParagraphs: KnowledgeTextLine[]
  phraseItems: KnowledgePhraseItem[]
  correction: KnowledgeCorrectionBlock
  noteParagraphs: KnowledgeTextLine[]
  hasKnowledgeContent: boolean
  dialogue: KnowledgeDialogueItem[]
}

Page<KnowledgePageData, WechatMiniprogram.IAnyObject>({
  data: {
    courseId: '',
    courseTitle: '知识点',
    loading: true,
    error: '',
    backgroundParagraphs: [],
    phraseItems: [],
    correction: {
      hasContent: false,
      promptLines: [],
      chinglishLines: [],
      nativeLines: [],
      extraLines: [],
    },
    noteParagraphs: [],
    hasKnowledgeContent: false,
    dialogue: [],
  },
  onLoad(query: { id?: string; courseId?: string; title?: string }) {
    enablePageShareMenu()
    const courseId = query.id || query.courseId || ''
    const courseTitle = query.title ? decodeURIComponent(query.title) : '知识点'
    this.setData({ courseId, courseTitle })

    if (!courseId) {
      this.setData({
        loading: false,
        error: '小节ID未找到',
      })
      return
    }

    void this.loadKnowledge(courseId)
  },
  async loadKnowledge(courseId: string) {
    this.setData({
      loading: true,
      error: '',
    })
    try {
      const detail = await fetchCourseDetail(courseId)
      this.applyDetail(detail)
    } catch (error) {
      const message = error instanceof Error ? error.message : '知识点加载失败，请稍后重试'
      this.setData({
        loading: false,
        error: message,
      })
    }
  },
  applyDetail(detail: CourseDetailResponse) {
    const knowledge = detail.knowledge
    const formattedKnowledge = formatKnowledgeContent({
      background: knowledge?.background,
      phrases: knowledge?.phrases,
      correction: knowledge?.correction,
      notes: knowledge?.notes,
    })
    const dialogue = formatKnowledgeDialogue(knowledge?.dialogue ?? [])

    this.setData({
      courseTitle: detail.title || this.data.courseTitle,
      ...formattedKnowledge,
      dialogue,
      loading: false,
      error: formattedKnowledge.hasKnowledgeContent || dialogue.length ? '' : '暂无知识点内容',
    })
  },
  handleRetry() {
    if (this.data.courseId) {
      void this.loadKnowledge(this.data.courseId)
    }
  },
  onShareAppMessage() {
    const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点')
    return buildAppMessageShare({
      title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
      path: `/pages/knowledge/knowledge?id=${this.data.courseId}&title=${encodedTitle}`,
    })
  },
  onShareTimeline() {
    const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点')
    return buildTimelineShare({
      title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
      query: this.data.courseId
        ? `id=${this.data.courseId}&title=${encodedTitle}`
        : '',
    })
  },
})
