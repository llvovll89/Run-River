package com.runriver.app;

import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.junit.*;
import org.junit.rules.TemporaryFolder;

public class MapFilesTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    private byte[] fixture() {
        byte[] header = new byte[127];
        System.arraycopy("PMTiles".getBytes(StandardCharsets.US_ASCII), 0, header, 0, 7);
        header[7] = 3; header[99] = 1; return header;
    }
    @Test public void validImportCanBeReadAndDeleted() throws Exception {
        MapFiles maps = new MapFiles(folder.getRoot());
        String id = maps.copy(new ByteArrayInputStream(fixture()));
        assertEquals(1, maps.list().length);
        assertArrayEquals(fixture(), maps.read(id, 0, 16384));
        assertArrayEquals(new byte[]{3}, maps.read(id, 7, 1));
        maps.delete(id); assertEquals(0, maps.list().length);
    }
    @Test public void invalidOrTruncatedImportNeverBecomesAvailable() throws Exception {
        MapFiles maps = new MapFiles(folder.getRoot());
        assertThrows(Exception.class, () -> maps.copy(new ByteArrayInputStream(new byte[10])));
        assertThrows(Exception.class, () -> maps.copy(new ByteArrayInputStream(new byte[127])));
        assertEquals(0, maps.list().length);
        assertEquals(0, new File(folder.getRoot(), "offline-maps").list().length);
    }
    @Test public void checksumMismatchCannotPublishAMap() throws Exception {
        MapFiles maps = new MapFiles(folder.getRoot());
        assertThrows(Exception.class, () -> maps.copy(new ByteArrayInputStream(fixture()), "invalid-checksum"));
        assertEquals(0, maps.list().length);
    }
    @Test public void pathTraversalAndUnboundedReadsAreRejected() throws Exception {
        MapFiles maps = new MapFiles(folder.getRoot());
        assertThrows(IOException.class, () -> maps.file("../../other-file"));
        String id = maps.copy(new ByteArrayInputStream(fixture()));
        assertThrows(IOException.class, () -> maps.read(id, -1, 10));
        assertThrows(IOException.class, () -> maps.read(id, 0, 20 * 1024 * 1024));
        assertThrows(IOException.class, () -> maps.read(id, 128, 1));
    }
}
