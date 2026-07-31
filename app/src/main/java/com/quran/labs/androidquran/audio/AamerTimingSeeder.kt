package com.quran.labs.androidquran.audio

import com.quran.labs.androidquran.util.QuranFileUtils
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.File

class AamerTimingSeeder @Inject constructor(
  private val quranFileUtils: QuranFileUtils
) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  fun seedIfNeeded() {
    scope.launch {
      runCatching {
        val audioDirectory = quranFileUtils.audioFileDirectory() ?: return@launch
        val aamerDirectory = File(audioDirectory, "aamer")
        val databaseFile = File(aamerDirectory, "aamer.db")
        if (!databaseFile.exists()) {
          quranFileUtils.copyFromAssetsRelative("recitations/aamer.zip", "aamer.zip", aamerDirectory)
        }
      }.onFailure {
        Timber.e(it, "failed to seed aamer timing database from assets")
      }
    }
  }
}
