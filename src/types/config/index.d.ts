export type Config = Readonly<{
  /**
   * Firebase用設定
   * 省略時は通知機能を無効化
   */
  firebase?: Readonly<{
    apiKey: string
    appId: string
    projectId: string
    messagingSenderId: string
  }>
  /**
   * skyway用設定
   * 省略時はQall機能を無効化
   */
  skyway?: Readonly<{
    apiKey: string
  }>
  /**
   * 検索機能を有効化するかどうか
   * 省略時は無効化
   */
  enableSearch?: boolean
  /**
   * アプリ一覧に表示されるサービス
   * 省略時はアプリ一覧ボタンを非表示にする
   */
  services?: ReadonlyArray<{
    /**
     * 表示名
     */
    label: string
    /**
     * `/img/services`からのアイコンへのパス(拡張子含む)
     */
    iconPath: string
    /**
     * リンク先
     */
    appLink: string
  }>
  /**
   * OGPが表示されないようにするホスト
   * 省略時は、すべてのホストのOGPを表示する
   */
  ogpIgnoreHostNames?: readonly string[]
  /**
   * Wikiのユーザーページへのリンク
   * undefinedにするとリンクが表示されない
   */
  wikiPageOrigin?: string
  /**
   * 外部認証が有効の場合の設定
   * 省略時は各種リンクが表示されない
   */
  auth?: Readonly<{
    /**
     * ログイン画面での「パスワードを忘れた」のリンクのリンク先
     */
    resetLink: string
    /**
     * 設定画面での「パスワードは～から可能です」のリンクのリンク先
     */
    changeLink: string
    /**
     * 設定画面での「パスワードは～から可能です」の「～」の表示
     */
    changeName: string
  }>
  /**
   * 内部用認証機構へのリダイレクト
   * 通常は`false`
   * 省略時は`false`
   */
  pipelineEnabled?: boolean
  /**
   * チャンネル変更権限をもっていないユーザーでも
   * チャンネル作成時に親チャンネルとしてrootを選択可能にする
   * サーバーでははじいていないので、APIをたたけば誰でも可能
   */
  isRootChannelSelectableAsParentChannel: boolean
  /**
   * QRコード表示ボタンの有効化
   * 省略時は`false`
   */
  showQrCodeButton?: boolean
  /**
   * 大きなファイルサイズのファイルを送信した際に表示される補足メッセージ
   * `%s`の部分には「画像」または「ファイル」が入る
   * @default '大きい%sの共有には別のサービスを利用してください。'
   */
  tooLargeFileMessage?: string
  /**
   * iframe埋め込みウィジェットのコピーボタンの有効化
   * 同じドメインの/widget/以下にtraQ-Widgetがデプロイされていることが前提
   * 省略時は`false`
   */
  showWidgetCopyButton?: boolean
}>

declare global {
  interface Window {
    traQConfig: Config
  }
}
