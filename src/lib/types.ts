export type Severity = 'error' | 'warning' | 'info'

export type IssueSource = 'ink' | 'lint'

export interface Issue {
  severity: Severity
  message: string
  line?: number
  source: IssueSource
}

export interface ChoiceView {
  index: number
  text: string
}

export interface PlayView {
  text: string
  tags: string[]
  choices: ChoiceView[]
  ended: boolean
}
