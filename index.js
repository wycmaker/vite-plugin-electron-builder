const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { mergeConfig } = require('vite')
const electronPath = require('electron')
const builder = require('electron-builder')

module.exports = function() {
  return [
    {
      name: 'electron-serve',
      apply: 'serve',
      enforce: 'post',
      configureServer(server) {
        server.httpServer.on('listening', () => {
          const address1 = server.httpServer.address()
          const { address, port } = JSON.parse(JSON.stringify(address1))
          const env = Object.assign(process.env, {
            VITE_DEV_SERVER_HOST: `http://${address}:${port}`
          })

          spawn(electronPath, ['.'], { stdio: 'inherit', env }).on('error', (err) => {
            console.log(err)
          }).on('close', () => {
            server.close()
          })
        })
      }
    },
    {
      name: 'electron-build',
      apply: 'build',
      enforce: 'post',
      closeBundle() {
        /* #region Copy package.json */

        const pkgContent = fs.readFileSync('./package.json', 'utf-8')
        let pkg = JSON.parse(pkgContent)
        const main = pkg.main
        pkg.main = 'background.js'
        pkg.dependencies = {}
        pkg.devDependencies = {}

        const userBuildConfig = pkg.build
        delete pkg.build

        const electronPkg = path.join(process.env.VITE_OUTPUT_DIR, '/package.json')
        const electronPkgLock = path.join(process.env.VITE_OUTPUT_DIR, '/package-lock.json')
        fs.appendFileSync(electronPkg, JSON.stringify(pkg, null, 2), 'utf-8')

        /* #endregion */

        /* #region Copy electron entry */

        const electronEntry = path.join(process.env.VITE_OUTPUT_DIR, 'background.js')
        fs.copyFileSync(`./${main}`, electronEntry)

        /* #endregion */

        /* #region Build Electron APP */

        const defaultConfig = {
          files: [
            `**`
          ],
          directories: {
            buildResources: 'build',
            output: './dist-electron',
            app: process.env.VITE_OUTPUT_DIR
          },
          extends: null
        }

        builder.build({
          config: mergeConfig(defaultConfig, userBuildConfig || {})
        }).then(() => {
          fs.rmSync(electronPkg)
          fs.rmSync(electronPkgLock)
          fs.rmSync(electronEntry)
          console.log('Build Complete !!')
        }).catch(err => {
          console.log(err)
          process.exit(1)
        })

        /* #endregion */
      }
    }
  ]
}