import * as Path from 'path'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { Repository } from '../../models/repository'
import {
  IPathPlannerPath,
  IPathPlannerAuto,
  IPathPlannerSettings,
  INavGrid,
  IAutoCommand,
} from '../../models/pathplanner'
import { getBlobContents } from '../git/show'
import {
  FileChange,
  WorkingDirectoryFileChange,
  CommittedFileChange,
} from '../../models/status'

export const DefaultSettings: IPathPlannerSettings = {
  robotWidth: 0.864,
  robotLength: 0.851,
  holonomicMode: true,
  defaultMaxVel: 4.5,
  defaultMaxAccel: 4.0,
  defaultMaxAngVel: 540.0,
  defaultMaxAngAccel: 720.0,
  bumperOffsetX: 0.0,
  bumperOffsetY: 0.0,
}

export const DefaultNavGrid: INavGrid = {
  field_size: { x: 16.54, y: 8.07 },
  nodeSizeMeters: 0.3,
  grid: [],
}

export function parsePath(jsonString: string): IPathPlannerPath | null {
  try {
    const data = JSON.parse(jsonString)
    if (data && Array.isArray(data.waypoints)) {
      return data as IPathPlannerPath
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null
}

export function parseAuto(jsonString: string): IPathPlannerAuto | null {
  try {
    const data = JSON.parse(jsonString)
    if (data && data.command && typeof data.command === 'object') {
      return data as IPathPlannerAuto
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null
}

export function findPathPlannerDir(filePath: string): string | null {
  const parts = filePath.split(/[/\\]/)
  const idx = parts.lastIndexOf('pathplanner')
  if (idx !== -1) {
    return parts.slice(0, idx + 1).join('/')
  }
  return null
}

export async function loadSettings(
  repositoryPath: string,
  relativeFilePath: string
): Promise<IPathPlannerSettings> {
  const ppDir = findPathPlannerDir(relativeFilePath)
  if (!ppDir) {
    return DefaultSettings
  }

  const fullSettingsPath = Path.join(repositoryPath, ppDir, 'settings.json')
  try {
    if (existsSync(fullSettingsPath)) {
      const content = await readFile(fullSettingsPath, 'utf8')
      const parsed = JSON.parse(content)
      return { ...DefaultSettings, ...parsed }
    }
  } catch {
    // Return defaults on error
  }

  return DefaultSettings
}

export async function loadNavGrid(
  repositoryPath: string,
  relativeFilePath: string
): Promise<INavGrid> {
  const ppDir = findPathPlannerDir(relativeFilePath)
  if (!ppDir) {
    return DefaultNavGrid
  }

  const fullNavGridPath = Path.join(repositoryPath, ppDir, 'navgrid.json')
  try {
    if (existsSync(fullNavGridPath)) {
      const content = await readFile(fullNavGridPath, 'utf8')
      const parsed = JSON.parse(content)
      return { ...DefaultNavGrid, ...parsed }
    }
  } catch {
    // Return defaults on error
  }

  return DefaultNavGrid
}

export function extractPathNamesFromCommand(
  cmd: IAutoCommand
): ReadonlyArray<string> {
  const paths: Array<string> = []

  function traverse(c: IAutoCommand) {
    if (c.type === 'path' && c.data.pathName) {
      paths.push(c.data.pathName)
    }
    if (c.data.commands && Array.isArray(c.data.commands)) {
      for (const child of c.data.commands) {
        traverse(child)
      }
    }
  }

  traverse(cmd)
  return paths
}

export async function resolveReferencedPath(
  repository: Repository,
  file: FileChange,
  pathName: string,
  isOld: boolean
): Promise<IPathPlannerPath | null> {
  const ppDir = findPathPlannerDir(file.path)
  if (!ppDir) {
    return null
  }

  const relativePath = `${ppDir}/paths/${pathName}.path`

  if (isOld) {
    let commitish = 'HEAD'
    if (file instanceof CommittedFileChange) {
      commitish = file.parentCommitish
    }
    try {
      const buf = await getBlobContents(repository, commitish, relativePath)
      return parsePath(buf.toString('utf8'))
    } catch {
      return null
    }
  } else {
    if (file instanceof WorkingDirectoryFileChange) {
      const fullPath = Path.join(repository.path, relativePath)
      try {
        if (existsSync(fullPath)) {
          const content = await readFile(fullPath, 'utf8')
          return parsePath(content)
        }
      } catch {
        return null
      }
    } else if (file instanceof CommittedFileChange) {
      try {
        const buf = await getBlobContents(
          repository,
          file.commitish,
          relativePath
        )
        return parsePath(buf.toString('utf8'))
      } catch {
        return null
      }
    }
  }

  return null
}
