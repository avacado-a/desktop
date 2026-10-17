import * as React from 'react'
import * as Path from 'path'
import { Repository } from '../../../models/repository'
import {
  FileChange,
  WorkingDirectoryFileChange,
  CommittedFileChange,
} from '../../../models/status'
import { ITextDiff, DiffSelection } from '../../../models/diff'
import { IFileContents } from '../syntax-highlighting'
import { SideBySideDiff } from '../side-by-side-diff'
import {
  IPathPlannerPath,
  IPathPlannerAuto,
  IPathPlannerSettings,
  INavGrid,
} from '../../../models/pathplanner'
import {
  parsePath,
  parseAuto,
  loadSettings,
  loadNavGrid,
  extractPathNamesFromCommand,
  resolveReferencedPath,
  DefaultSettings,
  DefaultNavGrid,
} from '../../../lib/pathplanner/context-loader'
import { PathVisualDiff } from './path-visual-diff'
import { AutoVisualDiff } from './auto-visual-diff'

interface IPathPlannerDiffContainerProps {
  readonly repository: Repository
  readonly file: FileChange
  readonly diff: ITextDiff
  readonly fileContents: IFileContents | null
  readonly readOnly: boolean
  readonly hideWhitespaceInDiff: boolean
  readonly showSideBySideDiff: boolean
  readonly showDiffCheckMarks: boolean
  readonly onIncludeChanged?: (diffSelection: DiffSelection) => void
  readonly onDiscardChanges?: (
    diff: ITextDiff,
    diffSelection: DiffSelection
  ) => void
  readonly askForConfirmationOnDiscardChanges?: boolean
  readonly onHideWhitespaceInDiffChanged: (checked: boolean) => void
}

interface IPathPlannerDiffContainerState {
  readonly oldPath: IPathPlannerPath | null
  readonly newPath: IPathPlannerPath | null
  readonly oldAuto: IPathPlannerAuto | null
  readonly newAuto: IPathPlannerAuto | null
  readonly oldResolvedPaths: ReadonlyMap<string, IPathPlannerPath>
  readonly newResolvedPaths: ReadonlyMap<string, IPathPlannerPath>
  readonly settings: IPathPlannerSettings
  readonly navgrid: INavGrid
  readonly loading: boolean
}

export class PathPlannerDiffContainer extends React.Component<
  IPathPlannerDiffContainerProps,
  IPathPlannerDiffContainerState
> {
  public constructor(props: IPathPlannerDiffContainerProps) {
    super(props)
    this.state = {
      oldPath: null,
      newPath: null,
      oldAuto: null,
      newAuto: null,
      oldResolvedPaths: new Map(),
      newResolvedPaths: new Map(),
      settings: DefaultSettings,
      navgrid: DefaultNavGrid,
      loading: true,
    }
  }

  public componentDidMount() {
    this.loadData()
  }

  public componentDidUpdate(prevProps: IPathPlannerDiffContainerProps) {
    if (
      prevProps.file.path !== this.props.file.path ||
      prevProps.fileContents !== this.props.fileContents
    ) {
      this.loadData()
    }
  }

  private async loadData() {
    const { repository, file, fileContents } = this.props
    const ext = Path.extname(file.path).toLowerCase()

    const oldText = fileContents?.oldContents?.join('\n') || ''
    const newText = fileContents?.newContents?.join('\n') || ''

    const [settings, navgrid] = await Promise.all([
      loadSettings(repository.path, file.path),
      loadNavGrid(repository.path, file.path),
    ])

    if (ext === '.path') {
      const oldPath = parsePath(oldText)
      const newPath = parsePath(newText)
      this.setState({
        oldPath,
        newPath,
        oldAuto: null,
        newAuto: null,
        settings,
        navgrid,
        loading: false,
      })
    } else if (ext === '.auto') {
      const oldAuto = parseAuto(oldText)
      const newAuto = parseAuto(newText)

      const oldNames = oldAuto
        ? extractPathNamesFromCommand(oldAuto.command)
        : []
      const newNames = newAuto
        ? extractPathNamesFromCommand(newAuto.command)
        : []

      const oldResolved = new Map<string, IPathPlannerPath>()
      const newResolved = new Map<string, IPathPlannerPath>()

      await Promise.all([
        ...oldNames.map(async name => {
          const p = await resolveReferencedPath(repository, file, name, true)
          if (p) {
            oldResolved.set(name, p)
          }
        }),
        ...newNames.map(async name => {
          const p = await resolveReferencedPath(repository, file, name, false)
          if (p) {
            newResolved.set(name, p)
          }
        }),
      ])

      this.setState({
        oldPath: null,
        newPath: null,
        oldAuto,
        newAuto,
        oldResolvedPaths: oldResolved,
        newResolvedPaths: newResolved,
        settings,
        navgrid,
        loading: false,
      })
    } else {
      this.setState({ loading: false })
    }
  }

  private renderRawJson = () => {
    return (
      <SideBySideDiff
        file={this.props.file}
        diff={this.props.diff}
        fileContents={this.props.fileContents}
        hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
        showSideBySideDiff={this.props.showSideBySideDiff}
        onIncludeChanged={this.props.onIncludeChanged}
        onDiscardChanges={this.props.onDiscardChanges}
        askForConfirmationOnDiscardChanges={
          this.props.askForConfirmationOnDiscardChanges
        }
        onHideWhitespaceInDiffChanged={this.props.onHideWhitespaceInDiffChanged}
        showDiffCheckMarks={this.props.showDiffCheckMarks}
      />
    )
  }

  public render() {
    if (this.state.loading) {
      return (
        <div className="pathplanner-loading">
          Loading PathPlanner visual diff…
        </div>
      )
    }

    const ext = Path.extname(this.props.file.path).toLowerCase()

    if (ext === '.path') {
      return (
        <PathVisualDiff
          oldPath={this.state.oldPath}
          newPath={this.state.newPath}
          settings={this.state.settings}
          navgrid={this.state.navgrid}
          onRenderRawJson={this.renderRawJson}
        />
      )
    }

    if (ext === '.auto') {
      return (
        <AutoVisualDiff
          oldAuto={this.state.oldAuto}
          newAuto={this.state.newAuto}
          oldResolvedPaths={this.state.oldResolvedPaths}
          newResolvedPaths={this.state.newResolvedPaths}
          settings={this.state.settings}
          navgrid={this.state.navgrid}
          onRenderRawJson={this.renderRawJson}
        />
      )
    }

    return this.renderRawJson()
  }
}
